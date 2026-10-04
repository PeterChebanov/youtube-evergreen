import { Injectable } from '@nestjs/common';
import { finalizePlan, planDraftSchema, researchQueriesSchema, type PlanContent, type PlanDraft } from '@youtube-ai-tool/shared';
import type { Project } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import { DbToolsService } from '../db-tools/db-tools.service';
import { FactResearchService } from '../fact-research/fact-research.service';
import { LlmService } from '../llm/llm.service';
import { ProjectsService } from '../projects/projects.service';
import { PromptComposer } from '../prompts/prompt-composer.service';
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
    const project = await this.projects.assertStatus(projectId, ['planning']);
    const previous = await this.projects.latestPlan(projectId);
    const notes = Array.isArray(project.shallowResearch) ? project.shallowResearch : [];
    return this.plan(project, { notes, feedback, previous: previous.content });
  }

  async saveManual(projectId: string, draft: PlanDraft): Promise<PlanVersionView> {
    const project = await this.projects.assertStatus(projectId, ['planning']);
    return this.save(project, finalizePlan(draft, project.targetDurationMin), 'manual edit');
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

  private async plan(project: Project, ctx: { notes: unknown; feedback?: string; previous?: PlanContent }): Promise<PlanVersionView> {
    const useDatabase = await this.dbTools.shouldUse(`${project.topic ?? ''}\n${ctx.feedback ?? ''}`, project.useDatabase);
    const { data, dbToolsUsed } = await this.llm.completeStructured({
      promptName: 'planning',
      projectId: project.id,
      system: await this.composer.planning(project, useDatabase),
      user: {
        project: {
          title: project.title,
          topic: project.topic,
          subtopic: project.subtopic,
          language: project.language,
          targetDurationMin: project.targetDurationMin,
        },
        sourceVideos: await this.sourceVideos(project),
        shallowResearch: ctx.notes,
        previousPlan: ctx.previous ?? null,
        feedback: ctx.feedback ?? null,
      },
      schema: planDraftSchema,
      tools: useDatabase ? this.dbTools.toolSet() : undefined,
    });
    const content = finalizePlan({ ...data, dbDataUsed: [...new Set([...data.dbDataUsed, ...dbToolsUsed])] }, project.targetDurationMin);
    return this.save(project, content, ctx.feedback ?? null);
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
      projectId: project.id,
      system: await this.composer.research('research_queries', project, false),
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
