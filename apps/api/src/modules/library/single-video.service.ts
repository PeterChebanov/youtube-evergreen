import { Injectable } from '@nestjs/common';
import { orNotFound } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import { YoutubeService } from '../youtube/youtube.service';
import { toNewVideo } from './video-sync';

@Injectable()
export class SingleVideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YoutubeService,
    private readonly analysis: AnalysisService,
  ) {}

  /**
   * Snapshot of one video for a custom request (REQUIREMENTS 2.13): library
   * data when the video is stored, otherwise a fresh analysis that is not saved.
   */
  async snapshot(url: string) {
    const yt = await this.youtube.videoByUrl(url);
    const stored = await this.prisma.video.findUnique({ where: { youtubeVideoId: yt.youtubeVideoId } });
    if (stored) {
      await this.analysis.ensureStructure(stored.id);
      return { inLibrary: true as const, videoId: stored.id, ...(await this.storedView(stored.id)) };
    }
    const raw = toNewVideo(yt);
    const analysis = await this.analysis.analyzeUnsaved({
      title: raw.title,
      description: raw.description,
      chapters: raw.chapters.map((c) => c.title),
    });
    return {
      inLibrary: false as const,
      videoId: null,
      youtubeVideoId: yt.youtubeVideoId,
      youtubeChannelId: yt.youtubeChannelId,
      channelName: yt.channelTitle,
      title: raw.title,
      url: raw.url,
      publishedAt: raw.publishedAt.toISOString(),
      views: raw.viewsAtResearch,
      durationSec: raw.durationSec,
      description: raw.description,
      chapters: raw.chapters.map((c) => ({ title: c.title, startTimestamp: c.startTimestamp, subsections: [] as string[] })),
      analysis,
    };
  }

  async storedView(videoId: string) {
    const v = orNotFound(
      await this.prisma.video.findUnique({
        where: { id: videoId },
        include: {
          channel: { select: { channelName: true, youtubeChannelId: true } },
          chapters: { orderBy: { order: 'asc' }, include: { subsections: { orderBy: { order: 'asc' } } } },
          analysis: { include: { genre: { select: { name: true } } } },
          snapshots: { orderBy: { researchedAt: 'asc' } },
        },
      }),
      'Video',
    );
    return {
      youtubeVideoId: v.youtubeVideoId,
      youtubeChannelId: v.channel.youtubeChannelId,
      channelName: v.channel.channelName,
      title: v.title,
      url: v.url,
      publishedAt: v.publishedAt.toISOString(),
      views: v.snapshots.at(-1)?.views ?? v.viewsAtResearch,
      durationSec: v.durationSec,
      description: v.description,
      chapters: v.chapters.map((c) => ({
        title: c.title,
        startTimestamp: c.startTimestamp,
        subsections: c.subsections.map((s) => s.title),
      })),
      analysis: v.analysis && {
        topic: v.analysis.topic,
        subtopic: v.analysis.subtopic,
        genre: v.analysis.genre?.name ?? null,
        contentType: v.analysis.contentType,
        format: v.analysis.format,
        titleType: v.analysis.titleType,
        hook: v.analysis.hook,
        transcriptAnalysis: v.analysis.transcriptAnalysis,
      },
      snapshots: v.snapshots.map((s) => ({ researchedAt: s.researchedAt.toISOString(), views: s.views })),
    };
  }
}
