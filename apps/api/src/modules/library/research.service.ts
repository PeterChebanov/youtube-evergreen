import { Injectable } from '@nestjs/common';
import { channelUrl, type ChannelDetail, type ChannelStatus, type ChannelSummary } from '@youtube-ai-tool/shared';
import type { Channel, ResearchJob } from '@prisma/client';
import { conflict, orNotFound } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { median } from '../advice/metrics';
import { LlmService } from '../llm/llm.service';
import { QUEUES, QueueService } from '../queue/queue.service';
import type { YoutubeChannel } from '../youtube/youtube.gateway';
import { YoutubeService } from '../youtube/youtube.service';

export const ACTIVE_JOB_STATUSES = ['queued', 'running', 'paused_quota'];
export type ResearchJobData = { researchJobId: string };

@Injectable()
export class ResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YoutubeService,
    private readonly llm: LlmService,
    private readonly queue: QueueService,
  ) {}

  /** Numbers for the confirm dialog before a research run (REQUIREMENTS 1.2). */
  async preview(input: string) {
    const yt = await this.youtube.resolveChannelUrl(input, { interactive: true });
    const channel = await this.prisma.channel.findUnique({ where: { youtubeChannelId: yt.youtubeChannelId } });
    const stored = channel ? await this.prisma.video.count({ where: { channelId: channel.id } }) : 0;
    const analysed = channel ? await this.prisma.videoAnalysis.count({ where: { video: { channelId: channel.id } } }) : 0;
    return {
      youtubeChannelId: yt.youtubeChannelId,
      channelName: yt.title,
      videoCount: yt.videoCount,
      inLibrary: !!channel,
      storedVideos: stored,
      estimate: this.llm.estimateResearchAnalysisCost(Math.max(0, yt.videoCount - analysed)),
    };
  }

  async start(input: string): Promise<ChannelSummary> {
    const yt = await this.youtube.resolveChannelUrl(input, { interactive: true });
    const channel = await this.upsertChannel(yt);
    return this.enqueue(channel, yt.videoCount);
  }

  /** Incremental re-run: new videos are added, known ones get a view snapshot (REQUIREMENTS 1.14). */
  async rerun(channelId: string): Promise<ChannelSummary> {
    const channel = orNotFound(await this.prisma.channel.findUnique({ where: { id: channelId } }), 'Channel');
    const yt = await this.youtube.channelById(channel.youtubeChannelId, { interactive: true });
    return this.enqueue(await this.upsertChannel(yt), yt.videoCount);
  }

  /** "Refresh views" for every fully researched channel. */
  async refreshAll(): Promise<{ queued: number }> {
    const channels = await this.prisma.channel.findMany({
      where: { researchStatus: { in: ['ready', 'analysis_failed'] }, researchJobs: { none: { status: { in: ACTIVE_JOB_STATUSES } } } },
    });
    for (const c of channels) await this.rerun(c.id);
    return { queued: channels.length };
  }

  async reanalyze(channelId: string): Promise<ChannelSummary> {
    const channel = orNotFound(await this.prisma.channel.findUnique({ where: { id: channelId } }), 'Channel');
    await this.assertIdle(channel.id);
    const job = await this.prisma.researchJob.create({
      data: { channelId, type: 'reanalyze', stage: 'analyze', progress: 40 },
    });
    await this.prisma.channel.update({ where: { id: channelId }, data: { researchStatus: 'analyzing', analysisError: null } });
    await this.queue.add<ResearchJobData>(QUEUES.research, { researchJobId: job.id });
    return this.summary(channelId);
  }

  async retry(researchJobId: string): Promise<ChannelSummary> {
    const job = orNotFound(await this.prisma.researchJob.findUnique({ where: { id: researchJobId } }), 'Research job');
    if (!['failed', 'paused_quota'].includes(job.status)) throw conflict(`Job is ${job.status}, nothing to retry`);
    await this.prisma.researchJob.update({ where: { id: job.id }, data: { status: 'queued', error: null, pausedUntil: null } });
    await this.queue.add<ResearchJobData>(QUEUES.research, { researchJobId: job.id });
    return this.summary(job.channelId);
  }

  /** A channel seen only through one video (Subtitles flow); not a full research. */
  async upsertPartialChannel(yt: YoutubeChannel): Promise<Channel> {
    const existing = await this.prisma.channel.findUnique({ where: { youtubeChannelId: yt.youtubeChannelId } });
    if (existing) return existing;
    return this.prisma.channel.create({ data: { ...this.channelFields(yt), researchStatus: 'partial' } });
  }

  async listChannels(): Promise<ChannelSummary[]> {
    const channels = await this.prisma.channel.findMany({ orderBy: { createdAt: 'desc' } });
    return Promise.all(channels.map((c) => this.toSummary(c)));
  }

  async summary(channelId: string): Promise<ChannelSummary> {
    return this.toSummary(orNotFound(await this.prisma.channel.findUnique({ where: { id: channelId } }), 'Channel'));
  }

  async detail(channelId: string): Promise<ChannelDetail> {
    const channel = orNotFound(
      await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: { authorStyles: { orderBy: { order: 'asc' } }, videos: { select: { viewsAtResearch: true, durationSec: true, _count: { select: { chapters: true } } } } },
      }),
      'Channel',
    );
    const n = channel.videos.length;
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
    return {
      id: channel.id,
      channelName: channel.channelName,
      stats: {
        videoCount: n,
        medianViews: median(channel.videos.map((v) => v.viewsAtResearch)),
        averageDurationSec: Math.round(avg(channel.videos.map((v) => v.durationSec))),
        chaptersPerVideo: avg(channel.videos.map((v) => v._count.chapters)),
      },
      authorStyles: channel.authorStyles.map(({ id, technique, description, order }) => ({ id, technique, description, order })),
    };
  }

  async channelVideos(channelId: string) {
    orNotFound(await this.prisma.channel.findUnique({ where: { id: channelId } }), 'Channel');
    return this.prisma.video.findMany({
      where: { channelId },
      orderBy: { viewsAtResearch: 'desc' },
      select: {
        id: true,
        youtubeVideoId: true,
        title: true,
        url: true,
        publishedAt: true,
        viewsAtResearch: true,
        durationSec: true,
        chaptersStatus: true,
        transcriptStatus: true,
        analysis: { select: { topic: true, contentType: true, genre: { select: { name: true } } } },
      },
    });
  }

  private async upsertChannel(yt: YoutubeChannel): Promise<Channel> {
    const existing = await this.prisma.channel.findUnique({ where: { youtubeChannelId: yt.youtubeChannelId } });
    if (existing) await this.assertIdle(existing.id);
    return this.prisma.channel.upsert({
      where: { youtubeChannelId: yt.youtubeChannelId },
      update: { ...this.channelFields(yt), researchStatus: 'collecting', analysisError: null },
      create: { ...this.channelFields(yt), researchStatus: 'collecting' },
    });
  }

  private channelFields(yt: YoutubeChannel) {
    return {
      youtubeChannelId: yt.youtubeChannelId,
      channelName: yt.title,
      youtubeUrl: channelUrl(yt.youtubeChannelId),
      description: yt.description,
      subscribers: yt.subscribers,
      uploadsPlaylistId: yt.uploadsPlaylistId,
    };
  }

  private async enqueue(channel: Channel, total: number): Promise<ChannelSummary> {
    const hasVideos = (await this.prisma.video.count({ where: { channelId: channel.id } })) > 0;
    const job = await this.prisma.researchJob.create({
      data: {
        channelId: channel.id,
        type: hasVideos ? 'incremental' : 'initial',
        total,
        estimatedCost: this.llm.estimateResearchAnalysisCost(total).estimatedUsd,
      },
    });
    await this.queue.add<ResearchJobData>(QUEUES.research, { researchJobId: job.id });
    return this.summary(channel.id);
  }

  private async assertIdle(channelId: string) {
    const active = await this.prisma.researchJob.findFirst({ where: { channelId, status: { in: ACTIVE_JOB_STATUSES } } });
    if (active) throw conflict('Research for this channel is already in progress');
  }

  private async toSummary(c: Channel): Promise<ChannelSummary> {
    const [videoCount, analyzedCount, job] = await Promise.all([
      this.prisma.video.count({ where: { channelId: c.id } }),
      this.prisma.videoAnalysis.count({ where: { video: { channelId: c.id } } }),
      this.prisma.researchJob.findFirst({ where: { channelId: c.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      id: c.id,
      youtubeChannelId: c.youtubeChannelId,
      channelName: c.channelName,
      youtubeUrl: c.youtubeUrl,
      researchStatus: c.researchStatus as ChannelStatus,
      analysisError: c.analysisError,
      lastResearchedAt: c.lastResearchedAt?.toISOString() ?? null,
      videoCount,
      analyzedCount,
      job: job ? jobView(job) : null,
    };
  }
}

const jobView = (j: ResearchJob) => ({
  id: j.id,
  status: j.status,
  stage: j.stage,
  progress: j.progress,
  error: j.error,
  pausedUntil: j.pausedUntil?.toISOString() ?? null,
});
