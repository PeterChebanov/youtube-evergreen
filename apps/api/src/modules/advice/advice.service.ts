import { Injectable, Logger } from '@nestjs/common';
import {
  adviceDraftSchema,
  adviceFiltersSchema,
  adviceRunStoredSchema,
  adviceTopicDraftSchema,
  type AdviceFilters,
  type AdviceRunResult,
  type AdviceTopic,
  DEFAULT_PERIOD,
  describePeriod,
  isProjectStatus,
  resolvePeriod,
} from '@youtube-ai-tool/shared';
import { conflict, errorMessage, invalid, orNotFound } from '../../common/domain-error';
import { maxSimilarity } from '../../common/vector';
import { EmbeddingRepository } from '../../prisma/embedding.repository';
import type { AdviceRun } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StatsRepository } from '../../prisma/stats.repository';
import { AnalysisService } from '../analysis/analysis.service';
import { LlmContextService } from '../llm/llm-context.service';
import { LlmService } from '../llm/llm.service';
import { PromptComposer } from '../prompts/prompt-composer.service';
import { parseAdviceRunResults, reconcileTopicProjects } from './advice-run-results';
import { DUPLICATE_SIMILARITY, rankCandidates } from './candidates';

const POOL_LIMIT = 600;
const CANDIDATES = 8;
const STRUCTURED_SOURCES = 3;
const RECENT_MONTHS = 12;

@Injectable()
export class AdviceService {
  private readonly logger = new Logger(AdviceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingRepository,
    private readonly stats: StatsRepository,
    private readonly analysis: AnalysisService,
    private readonly llm: LlmService,
    private readonly llmContext: LlmContextService,
    private readonly composer: PromptComposer,
  ) {}

  /** Three topics — one rework and two analogues — from the library (REQUIREMENTS 2.1–2.11). */
  async run(filters: AdviceFilters): Promise<AdviceRunResult> {
    const now = new Date();
    const period = filters.period ?? DEFAULT_PERIOD;
    const range = resolvePeriod(period, now);
    const pool = await this.prisma.video.findMany({
      where: {
        publishedAt: { gte: range.publishedAfter, lte: range.publishedBefore },
        analysis: { contentType: 'evergreen', ...(filters.genreIds.length ? { genreId: { in: filters.genreIds } } : {}) },
      },
      orderBy: { viewsAtResearch: 'desc' },
      take: POOL_LIMIT,
      select: {
        id: true,
        channelId: true,
        title: true,
        publishedAt: true,
        viewsAtResearch: true,
        durationSec: true,
        channel: { select: { channelName: true } },
        snapshots: { select: { researchedAt: true, views: true } },
        analysis: { select: { topic: true, hook: true, genre: { select: { name: true } } } },
      },
    });
    if (!pool.length) {
      throw conflict(`No evergreen videos in the library for "${describePeriod(period)}"${filters.genreIds.length ? ' and the chosen genres' : ''}. Research more channels or widen the filters.`);
    }

    const [vectors, medians, myVideos, recent, theme] = await Promise.all([
      this.embeddings.videoEmbeddings(pool.map((v) => v.id)),
      this.stats.channelMedians([...new Set(pool.map((v) => v.channelId))]),
      filters.skipMyVideos ? this.embeddings.myVideoEmbeddings() : Promise.resolve([]),
      this.embeddings.recentLibraryEmbeddings(new Date(now.getTime() - RECENT_MONTHS * 30 * 86_400_000)),
      filters.theme ? this.llm.embedOne(filters.theme) : Promise.resolve(null),
    ]);
    const poolIds = new Set(pool.map((v) => v.id));
    const ranked = rankCandidates(
      pool.map((v) => ({
        videoId: v.id,
        channelId: v.channelId,
        views: v.viewsAtResearch,
        publishedAt: v.publishedAt,
        snapshots: v.snapshots,
        embedding: vectors.get(v.id) ?? null,
      })),
      {
        now,
        channelMedians: medians,
        myVideoEmbeddings: myVideos.map((m) => m.vector),
        recentLibraryEmbeddings: recent.filter((r) => !poolIds.has(r.id)).map((r) => r.vector),
        themeEmbedding: theme,
        limit: CANDIDATES,
      },
    );
    if (!ranked.length) throw conflict('Every matching video repeats a topic from My Videos.');

    for (const c of ranked.slice(0, STRUCTURED_SOURCES)) {
      await this.analysis.ensureStructure(c.videoId).catch((e) => this.logger.warn(`Structure for ${c.videoId}: ${errorMessage(e)}`));
    }
    const chapters = await this.prisma.chapter.findMany({
      where: { videoId: { in: ranked.map((r) => r.videoId) } },
      orderBy: { order: 'asc' },
      select: { videoId: true, title: true, subsections: { select: { title: true }, orderBy: { order: 'asc' } } },
    });
    const byId = new Map(pool.map((v) => [v.id, v]));
    const candidates = ranked.map((r) => {
      const v = byId.get(r.videoId)!;
      return {
        id: v.id,
        title: v.title,
        channel: v.channel.channelName,
        views: v.viewsAtResearch,
        publishedAt: v.publishedAt.toISOString().slice(0, 10),
        relativeSuccess: r.relativeSuccess,
        velocityPerDay: r.velocityPerDay,
        topic: v.analysis?.topic,
        hook: v.analysis?.hook,
        genre: v.analysis?.genre?.name,
        chapters: chapters.filter((c) => c.videoId === v.id).map((c) => ({ title: c.title, subsections: c.subsections.map((s) => s.title) })),
      };
    });
    const myTitles = filters.skipMyVideos ? (await this.prisma.myVideo.findMany({ select: { title: true } })).map((m) => m.title) : [];

    const candidateIds = new Set(candidates.map((c) => c.id));
    const schema = adviceDraftSchema.superRefine((d, ctx) => {
      d.topics.forEach((t, i) => {
        if (!t.sourceVideoIds.some((id) => candidateIds.has(id))) {
          ctx.addIssue({ code: 'custom', path: ['topics', i, 'sourceVideoIds'], message: 'must reference candidate ids' });
        }
      });
    });
    const { data } = await this.llmContext.withRunOverrides(filters.llmModelOverrides ?? {}, async () =>
      this.llm.completeStructured({
        promptName: 'advice',
        stageId: 'advice',
        system: await this.composer.advice(filters.genreIds),
        user: {
          period: describePeriod(period),
          theme: filters.theme ?? null,
          language: filters.language,
          targetDurationMin: filters.targetDurationMin,
          candidates,
          avoidTopicsAlreadyMade: myTitles,
        },
        schema,
      }),
    );

    const topics: AdviceTopic[] = data.topics.map((t) => {
      const ids = t.sourceVideoIds.filter((id) => candidateIds.has(id));
      return {
        ...t,
        sourceVideoIds: ids,
        sources: ids.map((id) => {
          const v = byId.get(id)!;
          const r = ranked.find((x) => x.videoId === id)!;
          return {
            videoId: id,
            title: v.title,
            channelName: v.channel.channelName,
            views: v.viewsAtResearch,
            durationSec: v.durationSec,
            publishedAt: v.publishedAt.toISOString(),
            velocityPerDay: r.velocityPerDay,
            relativeSuccess: r.relativeSuccess,
          };
        }),
      };
    });
    const warnings = await this.duplicateWarnings(topics, myVideos);
    const run = await this.prisma.adviceRun.create({ data: { filters, results: { topics, warnings, topicProjects: {} } } });
    return { runId: run.id, topics, warnings };
  }

  /** Adjust one Advice topic before it becomes a project (author notes on chapters and angle). */
  async refineTopic(
    runId: string,
    topicIndex: number,
    feedback: string,
    llmModelOverrides?: AdviceFilters['llmModelOverrides'],
  ): Promise<{ runId: string; topicIndex: number; topic: AdviceTopic }> {
    const run = orNotFound(await this.prisma.adviceRun.findUnique({ where: { id: runId } }), 'Advice run');
    const raw = adviceRunStoredSchema.parse(run.results);
    const ids = new Set([...Object.values(raw.topicProjects), ...(run.projectId ? [run.projectId] : [])]);
    const projects = ids.size
      ? await this.prisma.project.findMany({ where: { id: { in: [...ids] } }, select: { id: true, title: true, topic: true } })
      : [];
    const stored = this.resolveRunStored(run, new Map(projects.map((p) => [p.id, p])));
    if (stored.topicProjects[String(topicIndex)]) {
      throw conflict('This Advice topic is already linked to a project');
    }
    const previous = stored.topics[topicIndex];
    if (!previous) throw invalid(`Topic index ${topicIndex} is out of range`);
    const filters = adviceFiltersSchema.parse(run.filters);

    const { data } = await this.llmContext.withRunOverrides(llmModelOverrides ?? {}, async () =>
      this.llm.completeStructured({
        promptName: 'advice',
        stageId: 'advice',
        system: await this.composer.advice(filters.genreIds),
        user: {
          mode: 'refine',
          language: filters.language,
          targetDurationMin: filters.targetDurationMin,
          previousTopic: {
            type: previous.type,
            title: previous.title,
            topic: previous.topic,
            subtopic: previous.subtopic ?? null,
            genre: previous.genre ?? null,
            rationale: previous.rationale,
            sourceVideoIds: previous.sourceVideoIds,
            draftChapters: previous.draftChapters,
            riddle: previous.riddle,
          },
          feedback,
        },
        schema: adviceTopicDraftSchema,
      }),
    );

    const videos = await this.prisma.video.findMany({
      where: { id: { in: data.sourceVideoIds } },
      select: {
        id: true,
        title: true,
        durationSec: true,
        viewsAtResearch: true,
        publishedAt: true,
        channel: { select: { channelName: true } },
      },
    });
    const byId = new Map(videos.map((v) => [v.id, v]));
    const sourceVideoIds = data.sourceVideoIds.filter((id) => byId.has(id));
    if (!sourceVideoIds.length) throw conflict('The refined topic must reference at least one library video');
    const topic: AdviceTopic = {
      ...data,
      sourceVideoIds,
      sources: sourceVideoIds.map((id) => {
        const v = byId.get(id)!;
        const prevSource = previous.sources.find((s) => s.videoId === id);
        return {
          videoId: id,
          title: v.title,
          channelName: v.channel.channelName,
          views: v.viewsAtResearch,
          durationSec: v.durationSec,
          publishedAt: v.publishedAt.toISOString(),
          velocityPerDay: prevSource?.velocityPerDay ?? 0,
          relativeSuccess: prevSource?.relativeSuccess ?? 0,
        };
      }),
    };

    const topics = stored.topics.slice();
    topics[topicIndex] = topic;
    await this.prisma.adviceRun.update({
      where: { id: runId },
      data: { results: { ...stored, topics } },
    });
    return { runId, topicIndex, topic };
  }

  async history() {
    const runs = await this.prisma.adviceRun.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return runs.map((r) => ({ runId: r.id, projectId: r.projectId, createdAt: r.createdAt.toISOString(), filters: r.filters, ...(r.results as object) }));
  }

  /** Every Advice topic ever generated (never deleted); pipeline stage comes from linked project. */
  async library() {
    const runs = await this.prisma.adviceRun.findMany({ orderBy: { createdAt: 'desc' } });
    const linkedIds = new Set<string>();
    for (const run of runs) {
      const raw = adviceRunStoredSchema.safeParse(run.results);
      if (raw.success) {
        for (const id of Object.values(raw.data.topicProjects)) linkedIds.add(id);
      }
      if (run.projectId) linkedIds.add(run.projectId);
    }
    const linkedProjects = linkedIds.size
      ? await this.prisma.project.findMany({
          where: { id: { in: [...linkedIds] } },
          select: { id: true, title: true, topic: true, status: true },
        })
      : [];
    const projectsById = new Map(linkedProjects.map((p) => [p.id, p]));

    const projectIds = new Set<string>();
    for (const run of runs) {
      try {
        const stored = this.resolveRunStored(run, projectsById);
        for (const id of Object.values(stored.topicProjects)) projectIds.add(id);
      } catch {
        /* skip corrupt rows */
      }
    }
    const projects = await this.prisma.project.findMany({
      where: { id: { in: [...projectIds] } },
      select: { id: true, status: true, title: true },
    });
    const statusById = new Map(projects.map((p) => [p.id, p.status]));
    const titleById = new Map(projects.map((p) => [p.id, p.title]));

    return runs.flatMap((run) => {
      let stored;
      try {
        stored = this.resolveRunStored(run, projectsById);
      } catch {
        return [];
      }
      const createdAt = run.createdAt.toISOString();
      return stored.topics.map((topic, topicIndex) => {
        const projectId = stored.topicProjects[String(topicIndex)] ?? null;
        const rawStatus = projectId ? statusById.get(projectId) : null;
        return {
          id: `${run.id}:${topicIndex}`,
          runId: run.id,
          topicIndex,
          createdAt,
          type: topic.type,
          title: topic.title,
          topic: topic.topic,
          rationale: topic.rationale,
          riddle: topic.riddle,
          genre: topic.genre,
          draftChapters: topic.draftChapters ?? [],
          projectId,
          projectTitle: projectId ? (titleById.get(projectId) ?? null) : null,
          projectStatus: rawStatus && isProjectStatus(rawStatus) ? rawStatus : null,
        };
      });
    });
  }

  private resolveRunStored(
    run: Pick<AdviceRun, 'results' | 'projectId'>,
    projectsById: Map<string, { title: string; topic: string | null }>,
  ) {
    const legacy = run.projectId ? projectsById.get(run.projectId) ?? null : null;
    const parsed = parseAdviceRunResults(run, legacy);
    const ids = [...Object.values(parsed.topicProjects), ...(run.projectId ? [run.projectId] : [])];
    return reconcileTopicProjects(parsed, ids, projectsById);
  }

  /** Final check against My Videos on the proposed wording (REQUIREMENTS 2.5, Q4). */
  private async duplicateWarnings(topics: AdviceTopic[], myVideos: Array<{ id: string; vector: number[] }>): Promise<string[]> {
    if (!myVideos.length) return [];
    const vectors = await this.llm.embed(topics.map((t) => `${t.title}\n${t.topic}\n${t.subtopic ?? ''}`));
    const titles = new Map((await this.prisma.myVideo.findMany({ select: { id: true, title: true } })).map((m) => [m.id, m.title]));
    return topics.flatMap((t, i) => {
      const closest = myVideos.reduce<{ id: string; sim: number } | null>((best, m) => {
        const sim = maxSimilarity(vectors[i], [m.vector]);
        return !best || sim > best.sim ? { id: m.id, sim } : best;
      }, null);
      return closest && closest.sim >= DUPLICATE_SIMILARITY
        ? [`"${t.title}" is close to your video "${titles.get(closest.id) ?? closest.id}"`]
        : [];
    });
  }
}
