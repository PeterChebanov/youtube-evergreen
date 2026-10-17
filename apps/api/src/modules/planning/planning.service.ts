import { Injectable } from '@nestjs/common';
import {
  PLAN_EDIT_STATUSES,
  applyManualPlanTiming,
  finalizePlan,
  planChapterCountRange,
  planDraftSchema,
  researchQueriesSchema,
  targetWordsForVideo,
  type PlanContent,
  type PlanDraft,
} from '@youtube-ai-tool/shared';
import { notFound } from '../../common/domain-error';
import type { Project } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import { DbToolsService } from '../db-tools/db-tools.service';
import { FactResearchService } from '../fact-research/fact-research.service';
import { LlmService } from '../llm/llm.service';
import { ProjectsService } from '../projects/projects.service';
import { projectContext, PromptComposer } from '../prompts/prompt-composer.service';
import { SearchService } from '../search/search.service';

const SHALLOW_NOTES = 6;
const NOTE_CHARS = 600;

type PlanVersionView = { version: number; content: PlanContent; feedback: string | null; createdAt: string };

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly llm: LlmService,
    private readonly composer: PromptComposer,
    private readonly search: SearchService,
    private readonly analysis: AnalysisService,
    private readonly dbTools: DbToolsService,
    private readonly facts: FactResearchService,
  ) {}

  /** First plan: shallow search, then planning (REQUIREMENTS 3.1–3.6). */
  async generate(projectId: string): Promise<PlanVersionView> {
    let project = await this.projects.assertStatus(projectId, ['draft', 'planning']);
    project = await this.projects.transition(projectId, 'planning');
    const notes = await this.shallowResearch(project);
    await this.prisma.project.update({ where: { id: projectId }, data: { shallowResearch: notes } });
    return this.plan(project, { notes });
  }

  async refine(projectId: string, feedback: string): Promise<PlanVersionView> {
    const project = await this.assertPlanEditable(projectId);
    const previous = await this.projects.latestPlan(projectId);
    const notes = Array.isArray(project.shallowResearch) ? project.shallowResearch : [];
    return this.plan(project, { notes, feedback, previous: previous.content });
  }

  async refineChapter(projectId: string, order: number, feedback: string): Promise<PlanVersionView> {
    const project = await this.assertPlanEditable(projectId);
    const previous = await this.projects.latestPlan(projectId);
    const chapter = this.requireChapter(previous.content, order);
    const notes = Array.isArray(project.shallowResearch) ? project.shallowResearch : [];
    return this.plan(project, {
      notes,
      feedback: `Change ONLY chapter ${order} ("${chapter.title}"). Author notes: ${feedback}. Keep every other chapter unchanged; preserve each chapter's lengthMin.`,
      previous: previous.content,
      preserveChapterLengths: true,
    });
  }

  async retryChapter(projectId: string, order: number, userNotes?: string): Promise<PlanVersionView> {
    const project = await this.assertPlanEditable(projectId);
    const previous = await this.projects.latestPlan(projectId);
    const chapter = this.requireChapter(previous.content, order);
    const notes = Array.isArray(project.shallowResearch) ? project.shallowResearch : [];
    const advice = this.adviceBrief(project);
    const extra = userNotes?.trim() ? ` Author direction: ${userNotes.trim()}.` : '';
    return this.plan(project, {
      notes,
      feedback: `Regenerate ONLY chapter ${order} ("${chapter.title}") from scratch with fresh hooks, subpoints and description. Ground the chapter in the original Advice brief: ${advice}. Current chapter to replace: ${JSON.stringify({ title: chapter.title, description: chapter.description, subpoints: chapter.subpoints })}.${extra} Keep every other chapter unchanged; preserve each remaining chapter's lengthMin.`,
      previous: previous.content,
      preserveChapterLengths: true,
    });
  }

  async addChapter(
    projectId: string,
    input: { insertAfter: number; description: string; lengthMin: number; title?: string },
  ): Promise<PlanVersionView> {
    const project = await this.assertPlanEditable(projectId);
    const previous = await this.projects.latestPlan(projectId);
    const { content } = previous;
    if (input.insertAfter > content.chapters.length) throw notFound(`Insert position ${input.insertAfter}`);
    const draft = this.contentToDraft(content);
    draft.chapters.splice(input.insertAfter, 0, {
      title: input.title?.trim() || 'New chapter',
      description: input.description.trim(),
      lengthMin: input.lengthMin,
      subpoints: [],
      hooks: [],
      techniques: [],
      ending: '',
      bridge: '',
      buildsOn: '',
      doNotRepeat: [],
    });
    const timed = applyManualPlanTiming(draft, project.targetDurationMin);
    const newOrder = input.insertAfter + 1;
    const notes = Array.isArray(project.shallowResearch) ? project.shallowResearch : [];
    const advice = this.adviceBrief(project);
    return this.plan(project, {
      notes,
      feedback: `Develop ONLY the NEW chapter at order ${newOrder} from this author brief: ${input.description.trim()}. Advice context: ${advice}. Give it rich subpoints, hooks, techniques, ending, bridge, buildsOn, doNotRepeat. Keep every OTHER chapter identical to previousPlan (same title, description, subpoints, hooks, lengthMin).`,
      previous: timed,
      preserveChapterLengths: { insertedAtIndex: input.insertAfter },
    });
  }

  /** Re-run the planning model on each chapter in sequence (one saved version). */
  async refineAllChapters(projectId: string): Promise<PlanVersionView> {
    const project = await this.assertPlanEditable(projectId);
    const notes = Array.isArray(project.shallowResearch) ? project.shallowResearch : [];
    let content = (await this.projects.latestPlan(projectId)).content;
    for (const ch of content.chapters) {
      content = await this.planContent(project, {
        notes,
        feedback: `Regenerate ONLY chapter ${ch.order} ("${ch.title}") from scratch. Keep other chapters unchanged; preserve each chapter's lengthMin.`,
        previous: content,
        preserveChapterLengths: true,
      });
    }
    return this.save(project, content, 'Refine all chapters (batch)');
  }

  async saveManual(projectId: string, draft: PlanDraft): Promise<PlanVersionView> {
    const project = await this.assertPlanEditable(projectId);
    return this.save(project, applyManualPlanTiming(draft, project.targetDurationMin), 'manual edit');
  }

  /** Re-scale chapter lengths after the author changes project target duration. */
  async rescaleToTarget(projectId: string): Promise<PlanVersionView> {
    const project = await this.assertPlanEditable(projectId);
    const { content } = await this.projects.latestPlan(projectId);
    return this.save(project, finalizePlan(this.contentToDraft(content), project.targetDurationMin), 'rescale to target');
  }

  /** "Send to research": locks the plan and starts the fact research (REQUIREMENTS 3.8). */
  async approve(projectId: string) {
    await this.projects.latestPlan(projectId);
    await this.projects.transition(projectId, 'plan_approved');
    return this.facts.start(projectId);
  }

  async versions(projectId: string): Promise<PlanVersionView[]> {
    await this.projects.load(projectId);
    const rows = await this.prisma.planVersion.findMany({ where: { projectId }, orderBy: { version: 'desc' } });
    return rows.map((r) => ({ version: r.version, content: r.content as PlanContent, feedback: r.feedback, createdAt: r.createdAt.toISOString() }));
  }

  private async plan(
    project: Project,
    ctx: {
      notes: unknown;
      feedback?: string;
      previous?: PlanContent;
      preserveChapterLengths?: true | { insertedAtIndex: number };
    },
  ): Promise<PlanVersionView> {
    const content = await this.planContent(project, ctx);
    return this.save(project, content, ctx.feedback ?? null);
  }

  private async planContent(
    project: Project,
    ctx: {
      notes: unknown;
      feedback?: string;
      previous?: PlanContent;
      preserveChapterLengths?: true | { insertedAtIndex: number };
    },
  ): Promise<PlanContent> {
    const useDatabase = await this.dbTools.shouldUse(`${project.topic ?? ''}\n${ctx.feedback ?? ''}`, project.useDatabase);
    const { data, dbToolsUsed } = await this.llm.completeStructured({
      promptName: 'planning',
      stageId: 'planning',
      projectId: project.id,
      system: await this.composer.planning(projectContext(project), useDatabase),
      user: {
        project: {
          title: project.title,
          topic: project.topic,
          subtopic: project.subtopic,
          language: project.language,
          targetDurationMin: project.targetDurationMin,
          chapterCountRange: planChapterCountRange(project.targetDurationMin),
          wordBudget: targetWordsForVideo(project.targetDurationMin),
        },
        sourceVideos: await this.sourceVideos(project),
        shallowResearch: ctx.notes,
        previousPlan: ctx.previous ?? null,
        feedback: ctx.feedback ?? null,
      },
      schema: planDraftSchema,
      tools: useDatabase ? this.dbTools.toolSet() : undefined,
    });
    const merged = { ...data, dbDataUsed: [...new Set([...data.dbDataUsed, ...dbToolsUsed])] };
    if (ctx.preserveChapterLengths && ctx.previous) {
      const inserted =
        ctx.preserveChapterLengths === true ? undefined : ctx.preserveChapterLengths.insertedAtIndex;
      return this.mergeLengthsByIndex(ctx.previous, merged, project.targetDurationMin, inserted);
    }
    return finalizePlan(merged, project.targetDurationMin);
  }

  /** Keep chapter lengths from the previous plan (by index); optional insert shifts indices after a new chapter. */
  private mergeLengthsByIndex(
    previous: PlanContent,
    draft: PlanDraft,
    targetDurationMin: number,
    insertedAtIndex?: number,
  ): PlanContent {
    const prevLens = previous.chapters.map((c) => c.lengthMin);
    const chapters = draft.chapters.map((c, i) => {
      let lengthMin = c.lengthMin;
      if (insertedAtIndex !== undefined) {
        if (i < insertedAtIndex) lengthMin = prevLens[i] ?? c.lengthMin;
        else if (i === insertedAtIndex) lengthMin = c.lengthMin;
        else lengthMin = prevLens[i - 1] ?? c.lengthMin;
      } else {
        lengthMin = prevLens[i] ?? c.lengthMin;
      }
      return { ...c, lengthMin };
    });
    return applyManualPlanTiming({ ...draft, chapters }, targetDurationMin);
  }

  private contentToDraft(content: PlanContent): PlanDraft {
    return {
      riddle: { ...content.riddle },
      narrativeFramework: content.narrativeFramework,
      recurringCast: content.recurringCast ?? [],
      chapters: content.chapters.map((c) => ({
        title: c.title,
        description: c.description,
        lengthMin: c.lengthMin,
        subpoints: c.subpoints ?? [],
        hooks: c.hooks ?? [],
        techniques: c.techniques ?? [],
        ending: c.ending ?? '',
        bridge: c.bridge ?? '',
        buildsOn: c.buildsOn ?? '',
        doNotRepeat: c.doNotRepeat ?? [],
      })),
      dbDataUsed: content.dbDataUsed ?? [],
    };
  }

  private adviceBrief(project: Project) {
    return [project.title, project.topic, project.subtopic].filter(Boolean).join(' · ');
  }

  private async assertPlanEditable(projectId: string) {
    return this.projects.assertStatus(projectId, [...PLAN_EDIT_STATUSES]);
  }

  private requireChapter(plan: PlanContent, order: number) {
    const chapter = plan.chapters.find((c) => c.order === order);
    if (!chapter) throw notFound(`Plan chapter ${order}`);
    return chapter;
  }

  private async save(project: Project, content: PlanContent, feedback: string | null): Promise<PlanVersionView> {
    const last = await this.prisma.planVersion.findFirst({ where: { projectId: project.id }, orderBy: { version: 'desc' } });
    const row = await this.prisma.planVersion.create({
      data: { projectId: project.id, version: (last?.version ?? 0) + 1, content, feedback },
    });
    return { version: row.version, content, feedback, createdAt: row.createdAt.toISOString() };
  }

  private async shallowResearch(project: Project) {
    const { data } = await this.llm.completeStructured({
      promptName: 'research_queries',
      stageId: 'plan_shallow_queries',
      projectId: project.id,
      system: await this.composer.research('research_queries', projectContext(project), false),
      user: { mode: 'shallow', topic: project.topic ?? project.title, language: project.language, chapter: null },
      schema: researchQueriesSchema,
    });
    const docs = await this.search.documents(data.queries.slice(0, 3), project.searchProviders);
    return docs.slice(0, SHALLOW_NOTES).map((d) => ({ url: d.url, title: d.title, text: d.text.slice(0, NOTE_CHARS) }));
  }

  private async sourceVideos(project: Project) {
    for (const id of project.sourceVideoIds) await this.analysis.ensureStructure(id);
    const stored = project.sourceVideoIds.length
      ? await this.prisma.video.findMany({
          where: { id: { in: project.sourceVideoIds } },
          select: {
            title: true,
            durationSec: true,
            viewsAtResearch: true,
            channel: { select: { channelName: true } },
            chapters: { orderBy: { order: 'asc' }, select: { title: true, startTimestamp: true, subsections: { select: { title: true } } } },
          },
        })
      : [];
    return project.sourceVideoSnapshot ? [...stored, project.sourceVideoSnapshot] : stored;
  }
}
