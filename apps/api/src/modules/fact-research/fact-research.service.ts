import { Injectable } from '@nestjs/common';
import {
  CHAPTER_WORK_STATES,
  FACT_EDIT_STATUSES,
  factExtractSchema,
  researchQueriesSchema,
  type FactDto,
  type FactResearchState,
  type PlanContent,
} from '@youtube-ai-tool/shared';
import type { JobRecord, Project, ResearchFact } from '@prisma/client';
import { z } from 'zod';
import { conflict, notFound, orNotFound } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { DbToolsService } from '../db-tools/db-tools.service';
import { LlmService } from '../llm/llm.service';
import { ProjectsService } from '../projects/projects.service';
import { projectContext, PromptComposer } from '../prompts/prompt-composer.service';
import { QUEUES, QueueService } from '../queue/queue.service';
import { SearchService } from '../search/search.service';
import { acceptFacts } from './fact-policy';

export const FACT_JOB = 'fact_research';
const ACTIVE = ['queued', 'running'];

export const factJobPayloadSchema = z.object({
  projectId: z.string(),
  feedback: z.string().nullable(),
  appendOnly: z.boolean().optional(),
  chapters: z.array(z.object({ order: z.number(), state: z.enum(CHAPTER_WORK_STATES), error: z.string().optional() })),
});
export type FactJobPayload = z.infer<typeof factJobPayloadSchema>;
export type FactJobData = { jobRecordId: string };

const relationsSchema = z.array(z.object({ factId: z.string(), kind: z.string() }));

function researchReferenceDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toFactDto(f: ResearchFact): FactDto {
  return {
    id: f.id,
    planChapterOrder: f.planChapterOrder,
    iteration: f.iteration,
    text: f.text,
    sourceUrl: f.sourceUrl,
    sourceTitle: f.sourceTitle,
    relations: relationsSchema.parse(f.relatedFacts) as FactDto['relations'],
  };
}

@Injectable()
export class FactResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly llm: LlmService,
    private readonly composer: PromptComposer,
    private readonly search: SearchService,
    private readonly dbTools: DbToolsService,
    private readonly queue: QueueService,
  ) {}

  /** Global research over the approved plan, chapter by chapter (REQUIREMENTS 4.1). */
  async start(projectId: string): Promise<FactResearchState> {
    await this.projects.transition(projectId, 'researching');
    const { content } = await this.projects.latestPlan(projectId);
    await this.enqueue(projectId, content.chapters.map((c) => c.order), null);
    return this.state(projectId);
  }

  /** Refine all chapters or one: drop weak facts and look for others (REQUIREMENTS 4.5). */
  async refine(projectId: string, feedback: string, chapterOrder?: number): Promise<FactResearchState> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    const { content } = await this.projects.latestPlan(projectId);
    const orders = chapterOrder ? [chapterOrder] : content.chapters.map((c) => c.order);
    if (chapterOrder && !content.chapters.some((c) => c.order === chapterOrder)) throw notFound(`Plan chapter ${chapterOrder}`);
    await this.enqueue(projectId, orders, feedback);
    return this.state(projectId);
  }

  async addFact(projectId: string, input: { planChapterOrder: number; text: string; sourceUrl: string; sourceTitle?: string }): Promise<FactDto> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    const { content } = await this.projects.latestPlan(projectId);
    if (!content.chapters.some((c) => c.order === input.planChapterOrder)) throw notFound(`Plan chapter ${input.planChapterOrder}`);
    const last = await this.prisma.researchFact.findFirst({
      where: { projectId, planChapterOrder: input.planChapterOrder },
      orderBy: { iteration: 'desc' },
    });
    const fact = await this.prisma.researchFact.create({
      data: { projectId, ...input, sourceTitle: input.sourceTitle ?? null, iteration: last?.iteration ?? 1 },
    });
    return toFactDto(fact);
  }

  async deleteFact(projectId: string, factId: string): Promise<void> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    const fact = await this.prisma.researchFact.findFirst({ where: { id: factId, projectId } });
    orNotFound(fact, 'Fact');
    await this.prisma.researchFact.delete({ where: { id: factId } });
  }

  /** "Send to writer" (REQUIREMENTS 4.6). */
  async approve(projectId: string): Promise<FactResearchState> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    if (await this.activeJob(projectId)) throw conflict('Fact research is still running');
    if (!(await this.prisma.researchFact.count({ where: { projectId } }))) throw conflict('There are no facts to hand to the writer');
    await this.projects.transition(projectId, 'research_approved');
    return this.state(projectId);
  }

  async state(projectId: string): Promise<FactResearchState> {
    const project = await this.projects.load(projectId);
    const { content } = await this.projects.latestPlan(projectId);
    const [job, facts] = await Promise.all([
      this.latestJob(projectId),
      this.prisma.researchFact.findMany({ where: { projectId }, orderBy: [{ planChapterOrder: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    const payload = job ? factJobPayloadSchema.parse(job.payload) : null;
    return {
      jobId: job?.id ?? null,
      status: job?.status ?? project.status,
      chapters: content.chapters.map((c) => {
        const count = facts.filter((f) => f.planChapterOrder === c.order).length;
        const tracked = payload?.chapters.find((x) => x.order === c.order)?.state;
        return { order: c.order, title: c.title, state: tracked ?? (count ? 'done' : 'queued'), factCount: count };
      }),
      facts: facts.map(toFactDto),
    };
  }

  /** Worker entry: researches each pending chapter and records its state. */
  async process(jobRecordId: string): Promise<void> {
    const job = await this.prisma.jobRecord.findUnique({ where: { id: jobRecordId } });
    if (!job || job.status === 'done') return;
    const payload = factJobPayloadSchema.parse(job.payload);
    const project = await this.projects.load(payload.projectId);
    const { content } = await this.projects.latestPlan(project.id);
    await this.saveJob(job.id, payload, { status: 'running' });

    for (const chapter of payload.chapters) {
      if (chapter.state === 'done') continue;
      chapter.state = 'run';
      delete chapter.error;
      await this.saveJob(job.id, payload, {});
      try {
        await this.researchChapter(project, content, chapter.order, payload.feedback, payload.appendOnly ?? false);
        chapter.state = 'done';
      } catch (e) {
        chapter.state = 'failed';
        chapter.error = e instanceof Error ? e.message : String(e);
      }
      await this.saveJob(job.id, payload, {});
    }
    const failed = payload.chapters.filter((c) => c.state === 'failed');
    await this.saveJob(job.id, payload, {
      status: failed.length ? 'failed' : 'done',
      error: failed.length ? failed.map((c) => `chapter ${c.order}: ${c.error}`).join('; ') : null,
    });
  }

  async retry(projectId: string): Promise<FactResearchState> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    const job = await this.latestJob(projectId);
    if (!job || job.status !== 'failed') throw conflict('There is no failed fact research to retry');
    await this.prisma.jobRecord.update({ where: { id: job.id }, data: { status: 'queued', error: null } });
    await this.queue.add<FactJobData>(QUEUES.facts, { jobRecordId: job.id });
    return this.state(projectId);
  }

  /** Drop all facts and research every chapter again from scratch. */
  async retryBatch(projectId: string): Promise<FactResearchState> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    const { content } = await this.projects.latestPlan(projectId);
    await this.prisma.researchFact.deleteMany({ where: { projectId } });
    await this.enqueue(projectId, content.chapters.map((c) => c.order), null);
    return this.state(projectId);
  }

  /** @deprecated use retryBatch */
  async retryBench(projectId: string): Promise<FactResearchState> {
    return this.retryBatch(projectId);
  }

  async retryOneFact(projectId: string, factId: string, userNotes?: string): Promise<FactResearchState> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    const fact = orNotFound(await this.prisma.researchFact.findFirst({ where: { id: factId, projectId } }), 'Fact');
    const others = await this.prisma.researchFact.findMany({
      where: { projectId, planChapterOrder: fact.planChapterOrder, id: { not: factId } },
    });
    await this.prisma.researchFact.delete({ where: { id: factId } });
    const keep = others.map((f) => f.text).join('; ') || '(none yet)';
    const extra = userNotes?.trim() ? ` Author direction: ${userNotes.trim()}.` : '';
    const feedback = `Find exactly one new verifiable fact for this chapter. Do not repeat or paraphrase facts already kept: ${keep}. Replace this removed fact with a different angle: ${fact.text}.${extra}`;
    await this.enqueue(projectId, [fact.planChapterOrder], feedback, { appendOnly: true });
    return this.state(projectId);
  }

  async refineOneFact(projectId: string, factId: string, userFeedback: string): Promise<FactResearchState> {
    await this.projects.assertStatus(projectId, [...FACT_EDIT_STATUSES]);
    const fact = orNotFound(await this.prisma.researchFact.findFirst({ where: { id: factId, projectId } }), 'Fact');
    const others = await this.prisma.researchFact.findMany({
      where: { projectId, planChapterOrder: fact.planChapterOrder, id: { not: factId } },
    });
    await this.prisma.researchFact.delete({ where: { id: factId } });
    const keep = others.map((f) => f.text).join('; ') || '(none)';
    const feedback = `Return exactly one refined fact to replace the removed one. Previous fact: ${fact.text}. Author instructions (what to add, remove, or change): ${userFeedback.trim()}. Other facts in this chapter stay as they are — do not repeat them: ${keep}`;
    await this.enqueue(projectId, [fact.planChapterOrder], feedback, { appendOnly: true });
    return this.state(projectId);
  }

  private async researchChapter(project: Project, plan: PlanContent, order: number, feedback: string | null, appendOnly = false) {
    const chapter = plan.chapters.find((c) => c.order === order);
    if (!chapter) throw new Error('chapter is not in the plan');
    const existing = await this.prisma.researchFact.findMany({ where: { projectId: project.id, planChapterOrder: order } });
    const useDatabase = await this.dbTools.shouldUse(feedback ?? '', project.useDatabase);
    const chapterBrief = { order, title: chapter.title, description: chapter.description, subpoints: chapter.subpoints };
    const referenceDate = researchReferenceDate();
    const factResearchLayers = { factGeography: true, factRecency: true } as const;

    const { data: q } = await this.llm.completeStructured({
      promptName: 'research_queries',
      stageId: 'fact_research_queries',
      projectId: project.id,
      system: await this.composer.research('research_queries', projectContext(project), useDatabase, factResearchLayers),
      user: {
        mode: 'global',
        topic: project.topic ?? project.title,
        language: project.language,
        riddle: plan.riddle.question,
        chapter: chapterBrief,
        referenceDate,
        feedback,
        knownFacts: existing.map((f) => f.text),
      },
      schema: researchQueriesSchema,
      tools: useDatabase ? this.dbTools.toolSet() : undefined,
    });
    const sources = await this.search.documents(q.queries, project.searchProviders);
    if (!sources.length) throw new Error('search returned no sources');

    const { data } = await this.llm.completeStructured({
      promptName: 'fact_extract',
      stageId: 'fact_extract',
      projectId: project.id,
      system: await this.composer.research('fact_extract', projectContext(project), false, factResearchLayers),
      user: {
        chapter: chapterBrief,
        referenceDate,
        feedback,
        singleFact: appendOnly,
        previousFacts: feedback ? existing.map((f) => ({ text: f.text, sourceUrl: f.sourceUrl })) : [],
        sources: sources.map((s, index) => ({ index, ...s })),
      },
      schema: factExtractSchema,
    });
    let accepted = acceptFacts(data.facts, sources);
    if (appendOnly) accepted = accepted.slice(0, 1);
    if (!accepted.length) throw new Error('no facts with a verifiable source were found');

    const iteration = appendOnly
      ? Math.max(1, ...existing.map((f) => f.iteration))
      : Math.max(0, ...existing.map((f) => f.iteration)) + 1;
    await this.prisma.$transaction(async (tx) => {
      if (!appendOnly) await tx.researchFact.deleteMany({ where: { projectId: project.id, planChapterOrder: order } });
      const created: ResearchFact[] = [];
      for (const f of accepted) {
        created.push(
          await tx.researchFact.create({
            data: { projectId: project.id, planChapterOrder: order, iteration, text: f.text, sourceUrl: f.sourceUrl, sourceTitle: f.sourceTitle },
          }),
        );
      }
      for (const [i, f] of accepted.entries()) {
        if (!f.relations.length) continue;
        await tx.researchFact.update({
          where: { id: created[i].id },
          data: { relatedFacts: f.relations.map((r) => ({ factId: created[r.toIndex].id, kind: r.kind })) },
        });
      }
    });
  }

  private async enqueue(projectId: string, orders: number[], feedback: string | null, opts?: { appendOnly?: boolean }) {
    if (await this.activeJob(projectId)) throw conflict('Fact research for this project is already running');
    const payload: FactJobPayload = {
      projectId,
      feedback,
      appendOnly: opts?.appendOnly,
      chapters: orders.map((order) => ({ order, state: 'queued' })),
    };
    const job = await this.prisma.jobRecord.create({ data: { type: FACT_JOB, status: 'queued', total: orders.length, payload } });
    await this.queue.add<FactJobData>(QUEUES.facts, { jobRecordId: job.id });
  }

  private latestJob(projectId: string): Promise<JobRecord | null> {
    return this.prisma.jobRecord.findFirst({
      where: { type: FACT_JOB, payload: { path: ['projectId'], equals: projectId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async activeJob(projectId: string) {
    const job = await this.latestJob(projectId);
    return job && ACTIVE.includes(job.status) ? job : null;
  }

  private async saveJob(id: string, payload: FactJobPayload, extra: { status?: string; error?: string | null }) {
    const done = payload.chapters.filter((c) => c.state === 'done' || c.state === 'failed').length;
    await this.prisma.jobRecord.update({
      where: { id },
      data: { ...extra, payload, cursor: done, progress: Math.round((100 * done) / Math.max(payload.chapters.length, 1)) },
    });
  }
}
