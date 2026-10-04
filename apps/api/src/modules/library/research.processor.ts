import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma, ResearchJob } from '@prisma/client';
import { errorMessage } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { ANALYSIS_BATCH_SIZE, AnalysisService } from '../analysis/analysis.service';
import { GenresService } from '../genres/genres.service';
import { QUEUES, QueueService } from '../queue/queue.service';
import { QuotaExceededError } from '../youtube/quota';
import { YoutubeService } from '../youtube/youtube.service';
import type { ResearchJobData } from './research.service';
import { VideoIngestService } from './video-ingest.service';

const COLLECT_SHARE = 40;
const ANALYZE_SHARE = 55;

/**
 * Research pipeline collect → analyze → author. Each stage persists its
 * progress, so a job paused by the YouTube quota or failed mid-way resumes
 * where it stopped (REQUIREMENTS 1.1–1.4, 1.12, 1.14).
 */
@Injectable()
export class ResearchProcessor implements OnModuleInit {
  private readonly logger = new Logger(ResearchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly youtube: YoutubeService,
    private readonly ingest: VideoIngestService,
    private readonly analysis: AnalysisService,
    private readonly genres: GenresService,
  ) {}

  onModuleInit() {
    this.queue.work<ResearchJobData>(QUEUES.research, (job) => this.process(job.data.researchJobId));
  }

  async process(researchJobId: string): Promise<void> {
    let job = await this.prisma.researchJob.findUnique({ where: { id: researchJobId } });
    if (!job || job.status === 'done') return;
    job = await this.update(job.id, { status: 'running', error: null, pausedUntil: null });

    try {
      if (job.stage === 'collect') {
        job = await this.collect(job);
        job = await this.update(job.id, { stage: 'analyze' });
        await this.setChannel(job.channelId, { researchStatus: 'analyzing' });
      }
      if (job.stage === 'analyze') {
        await this.analyze(job);
        job = await this.update(job.id, { stage: 'author' });
      }
      if (job.stage === 'author') {
        const styles = await this.prisma.authorStyle.count({ where: { channelId: job.channelId } });
        if (job.newVideos > 0 || styles === 0) await this.analysis.analyzeAuthorStyle(job.channelId);
      }
      await this.update(job.id, { stage: 'done', status: 'done', progress: 100 });
      await this.setChannel(job.channelId, { researchStatus: 'ready', analysisError: null, lastResearchedAt: new Date() });
    } catch (e) {
      await this.handleFailure(job.id, e);
      return;
    }

    const result = await this.genres.recomputeAll().catch((e) => ({ updated: 0, failed: [errorMessage(e)] }));
    if (result.failed.length) this.logger.warn(`Genre recompute incomplete: ${result.failed.join(', ')}`);
  }

  private async collect(job: ResearchJob): Promise<ResearchJob> {
    const channel = await this.prisma.channel.findUniqueOrThrow({ where: { id: job.channelId } });
    if (!channel.uploadsPlaylistId) throw new Error('Channel has no uploads playlist');
    let { cursor, processed, newVideos } = job;
    let first = true;
    while (first || cursor) {
      first = false;
      const page = await this.youtube.listUploads(channel.uploadsPlaylistId, cursor);
      const videos = await this.youtube.getVideos(page.videoIds);
      const synced = await this.ingest.syncPage(channel.id, videos);
      processed += page.videoIds.length;
      newVideos += synced.created;
      cursor = page.nextPageToken;
      const progress = job.total ? Math.min(COLLECT_SHARE, Math.round((COLLECT_SHARE * processed) / job.total)) : 0;
      job = await this.update(job.id, { cursor, processed, newVideos, progress });
    }
    return job;
  }

  private async analyze(job: ResearchJob): Promise<void> {
    const where = { channelId: job.channelId, analysis: null };
    for (;;) {
      const pending = await this.prisma.video.findMany({ where, select: { id: true }, take: ANALYSIS_BATCH_SIZE, orderBy: { publishedAt: 'desc' } });
      if (!pending.length) return;
      await this.analysis.analyzeBasic(pending.map((p) => p.id));
      const [total, left] = await Promise.all([
        this.prisma.video.count({ where: { channelId: job.channelId } }),
        this.prisma.video.count({ where }),
      ]);
      await this.update(job.id, { progress: COLLECT_SHARE + Math.round((ANALYZE_SHARE * (total - left)) / Math.max(total, 1)) });
    }
  }

  private async handleFailure(jobId: string, e: unknown) {
    const job = await this.prisma.researchJob.findUniqueOrThrow({ where: { id: jobId } });
    if (e instanceof QuotaExceededError) {
      await this.update(jobId, { status: 'paused_quota', pausedUntil: e.resetAt, error: e.message });
      await this.queue.add<ResearchJobData>(QUEUES.research, { researchJobId: jobId }, { delay: e.resetAt.getTime() - Date.now() + 60_000 });
      return;
    }
    const message = errorMessage(e);
    this.logger.error(`Research job ${jobId} failed at ${job.stage}: ${message}`);
    await this.update(jobId, { status: 'failed', error: message });
    if (job.stage !== 'collect') await this.setChannel(job.channelId, { researchStatus: 'analysis_failed', analysisError: message });
  }

  private update(id: string, data: Prisma.ResearchJobUncheckedUpdateInput) {
    return this.prisma.researchJob.update({ where: { id }, data });
  }

  private setChannel(id: string, data: { researchStatus: string; analysisError?: string | null; lastResearchedAt?: Date }) {
    return this.prisma.channel.update({ where: { id }, data });
  }
}
