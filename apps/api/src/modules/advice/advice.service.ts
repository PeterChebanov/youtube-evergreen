import { Injectable, Logger } from '@nestjs/common';
import {
  adviceDraftSchema,
  type AdviceFilters,
  type AdviceRunResult,
  type AdviceTopic,
  DEFAULT_PERIOD,
  describePeriod,
  resolvePeriod,
} from '@youtube-ai-tool/shared';
import { conflict, errorMessage } from '../../common/domain-error';
import { maxSimilarity } from '../../common/vector';
import { EmbeddingRepository } from '../../prisma/embedding.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { StatsRepository } from '../../prisma/stats.repository';
import { AnalysisService } from '../analysis/analysis.service';
import { LlmService } from '../llm/llm.service';
import { PromptComposer } from '../prompts/prompt-composer.service';
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
    const { data } = await this.llm.completeStructured({
      promptName: 'advice',
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
    });

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
    const run = await this.prisma.adviceRun.create({ data: { filters, results: { topics, warnings } } });
    return { runId: run.id, topics, warnings };
  }

  async history() {
    const runs = await this.prisma.adviceRun.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return runs.map((r) => ({ runId: r.id, projectId: r.projectId, createdAt: r.createdAt.toISOString(), filters: r.filters, ...(r.results as object) }));
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
