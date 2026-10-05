import { Injectable } from '@nestjs/common';
import {
  authorStyleResponseSchema,
  transcriptAnalysisSchema,
  videoBasicBatchSchema,
  videoStructureSchema,
  type VideoBasicItem,
} from '@youtube-ai-tool/shared';
import { conflict, orNotFound, unavailable } from '../../common/domain-error';
import { EmbeddingRepository } from '../../prisma/embedding.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { median } from '../advice/metrics';
import { LlmService } from '../llm/llm.service';
import { PromptComposer } from '../prompts/prompt-composer.service';
import { UNAVAILABLE } from '../library/video-sync';

export const ANALYSIS_BATCH_SIZE = 20;
const TRANSCRIPT_LIMIT = 24000;

const text = (v: string | null | undefined) => (v && v !== UNAVAILABLE ? v : null);

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingRepository,
    private readonly llm: LlmService,
    private readonly composer: PromptComposer,
  ) {}

  /** Basic analysis (REQUIREMENTS 1.12) for up to one batch of videos; returns how many were analysed. */
  async analyzeBasic(videoIds: string[]): Promise<number> {
    const videos = await this.prisma.video.findMany({
      where: { id: { in: videoIds.slice(0, ANALYSIS_BATCH_SIZE) }, analysis: null },
      include: { chapters: { orderBy: { order: 'asc' } } },
    });
    if (!videos.length) return 0;
    const genres = await this.prisma.genre.findMany({ select: { id: true, name: true } });
    const genreByName = new Map(genres.map((g) => [g.name.toLowerCase(), g.id]));

    const { data } = await this.llm.completeStructured({
      promptName: 'video_basic',
      stageId: 'video_basic',
      system: await this.composer.single('video_basic'),
      user: {
        genres: genres.map((g) => g.name),
        videos: videos.map((v) => ({
          videoId: v.id,
          title: v.title,
          description: text(v.description)?.slice(0, 1500) ?? null,
          chapters: v.chapters.map((c) => c.title),
        })),
      },
      schema: videoBasicBatchSchema,
    });

    const byId = new Map(videos.map((v) => [v.id, v]));
    const items = data.items.filter((i) => byId.has(i.videoId));
    if (!items.length) throw unavailable('Basic analysis returned no usable items for this batch');

    const vectors = await this.llm.embed(
      items.map((i) => {
        const v = byId.get(i.videoId)!;
        return [v.title, i.topic, i.subtopic, text(v.description)?.slice(0, 500)].filter(Boolean).join('\n');
      }),
    );
    for (const [n, item] of items.entries()) {
      await this.prisma.videoAnalysis.upsert({
        where: { videoId: item.videoId },
        update: {},
        create: {
          videoId: item.videoId,
          genreId: genreByName.get(item.genre.toLowerCase()) ?? null,
          contentType: item.contentType,
          topic: item.topic,
          subtopic: item.subtopic ?? null,
          format: item.format,
          titleType: item.titleType,
          hook: item.hook,
        },
      });
      await this.embeddings.setVideoEmbedding(item.videoId, vectors[n]);
    }
    return items.length;
  }

  /** Same analysis for a video outside the library; nothing is stored (REQUIREMENTS 2.13). */
  async analyzeUnsaved(video: { title: string; description: string; chapters: string[] }): Promise<VideoBasicItem | null> {
    const genres = await this.prisma.genre.findMany({ select: { name: true } });
    const { data } = await this.llm.completeStructured({
      promptName: 'video_basic',
      stageId: 'video_basic',
      system: await this.composer.single('video_basic'),
      user: {
        genres: genres.map((g) => g.name),
        videos: [{ videoId: 'snapshot', title: video.title, description: text(video.description)?.slice(0, 1500) ?? null, chapters: video.chapters }],
      },
      schema: videoBasicBatchSchema,
    });
    return data.items[0] ?? null;
  }

  /** 2–10 signature techniques of a fully researched channel (REQUIREMENTS 1.9). */
  async analyzeAuthorStyle(channelId: string): Promise<void> {
    const channel = orNotFound(await this.prisma.channel.findUnique({ where: { id: channelId } }), 'Channel');
    const videos = await this.prisma.video.findMany({
      where: { channelId },
      include: { analysis: { select: { topic: true, format: true, titleType: true, hook: true } } },
    });
    if (!videos.length) return;
    const channelMedian = median(videos.map((v) => v.viewsAtResearch));
    const top = [...videos].sort((a, b) => b.viewsAtResearch - a.viewsAtResearch).slice(0, 15);

    const { data } = await this.llm.completeStructured({
      promptName: 'author_style',
      stageId: 'author_style',
      system: await this.composer.single('author_style'),
      user: {
        channelName: channel.channelName,
        medianViews: channelMedian,
        videos: top.map((v) => ({
          id: v.id,
          title: v.title,
          views: v.viewsAtResearch,
          description: text(v.description)?.slice(0, 300) ?? null,
          ...v.analysis,
        })),
      },
      schema: authorStyleResponseSchema,
    });

    const validIds = new Set(videos.map((v) => v.id));
    await this.prisma.$transaction([
      this.prisma.authorStyle.deleteMany({ where: { channelId } }),
      this.prisma.authorStyle.createMany({
        data: data.techniques.map((t, i) => ({
          channelId,
          technique: t.technique,
          description: t.description,
          exampleVideoIds: t.exampleVideoIds.filter((id) => validIds.has(id)),
          order: i + 1,
        })),
      }),
    ]);
  }

  /** Chapters and sub-sections on demand (REQUIREMENTS 1.13); idempotent. */
  async ensureStructure(videoId: string): Promise<void> {
    const video = orNotFound(
      await this.prisma.video.findUnique({
        where: { id: videoId },
        include: { chapters: { orderBy: { order: 'asc' }, include: { subsections: true } } },
      }),
      'Video',
    );
    if (video.structureStatus === 'done') return;

    const { data } = await this.llm.completeStructured({
      promptName: 'video_structure',
      stageId: 'video_structure',
      system: await this.composer.single('video_structure'),
      user: {
        title: video.title,
        description: text(video.description)?.slice(0, 3000) ?? null,
        chapters: video.chapters.map((c) => ({ title: c.title, startTimestamp: c.startTimestamp })),
        transcript: text(video.transcript)?.slice(0, TRANSCRIPT_LIMIT) ?? null,
      },
      schema: videoStructureSchema,
    });

    await this.prisma.$transaction(async (tx) => {
      let chapters = video.chapters;
      if (!chapters.length) {
        chapters = [];
        for (const [i, c] of data.chapters.entries()) {
          const created = await tx.chapter.create({
            data: { videoId, title: c.title, startTimestamp: c.startTimestamp, order: i + 1, source: 'ai' },
            include: { subsections: true },
          });
          chapters.push(created);
        }
      }
      for (const [i, chapter] of chapters.entries()) {
        const match = data.chapters.find((c) => c.title.trim().toLowerCase() === chapter.title.trim().toLowerCase()) ?? data.chapters[i];
        if (!match || chapter.subsections.length) continue;
        await tx.subsection.createMany({
          data: match.subsections.map((s, j) => ({
            chapterId: chapter.id,
            title: s.title,
            description: s.description ?? null,
            timestamp: s.timestamp ?? null,
            order: j + 1,
          })),
        });
      }
      await tx.video.update({ where: { id: videoId }, data: { structureStatus: 'done' } });
    });
  }

  /** Tone and delivery from subtitles (REQUIREMENTS 6.4) plus structure refinement. */
  async analyzeTranscript(videoId: string) {
    const video = orNotFound(await this.prisma.video.findUnique({ where: { id: videoId } }), 'Video');
    if (video.transcriptStatus !== 'done' || !text(video.transcript)) {
      throw conflict('This video has no subtitles to analyse');
    }
    const { data } = await this.llm.completeStructured({
      promptName: 'transcript_analysis',
      stageId: 'transcript_analysis',
      system: await this.composer.single('transcript_analysis'),
      user: { title: video.title, transcript: video.transcript!.slice(0, TRANSCRIPT_LIMIT) },
      schema: transcriptAnalysisSchema,
    });
    if (!(await this.prisma.videoAnalysis.findUnique({ where: { videoId } }))) await this.analyzeBasic([videoId]);
    await this.prisma.videoAnalysis.update({
      where: { videoId },
      data: { transcriptAnalysis: data, transcriptAnalyzedAt: new Date() },
    });
    await this.prisma.video.update({ where: { id: videoId }, data: { structureStatus: 'none' } });
    await this.ensureStructure(videoId);
    return data;
  }
}
