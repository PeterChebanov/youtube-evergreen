import { Injectable } from '@nestjs/common';
import { formatChannelHandleLabel } from '@youtube-ai-tool/shared';
import { ConfigService } from '@nestjs/config';
import { invalid } from '../../common/domain-error';
import type { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import type { YoutubeVideo } from '../youtube/youtube.gateway';
import { isLongForm, NewVideo, planVideoSync, toNewVideo } from './video-sync';

/** The only writer of Video rows: research pages and single videos added from Subtitles go through here. */
@Injectable()
export class VideoIngestService {
  private readonly minDurationSec: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.minDurationSec = config.get('youtube', { infer: true }).shortsMinDurationSec;
  }

  async syncPage(channelId: string, fetched: YoutubeVideo[]): Promise<{ created: number; snapshotted: number }> {
    const known = await this.prisma.video.findMany({
      where: { youtubeVideoId: { in: fetched.map((v) => v.youtubeVideoId) } },
      select: { id: true, youtubeVideoId: true },
    });
    const plan = planVideoSync(fetched, new Map(known.map((k) => [k.youtubeVideoId, k.id])), this.minDurationSec);
    for (const v of plan.create) await this.create(channelId, v);
    if (plan.snapshot.length) {
      await this.prisma.researchSnapshot.createMany({ data: plan.snapshot.map((s) => ({ videoId: s.videoId, views: s.views })) });
    }
    return { created: plan.create.length, snapshotted: plan.snapshot.length };
  }

  /** Adds one video (Subtitles flow); returns the existing row if it is already stored. */
  async addSingle(channelId: string, video: YoutubeVideo): Promise<string> {
    const existing = await this.prisma.video.findUnique({ where: { youtubeVideoId: video.youtubeVideoId } });
    if (existing) return existing.id;
    if (!isLongForm(video, this.minDurationSec)) throw invalid('Shorts are not stored in the library');
    return this.create(channelId, toNewVideo(video));
  }

  private async create(channelId: string, v: NewVideo): Promise<string> {
    const { chapters, ...fields } = v;
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId }, select: { youtubeHandle: true } });
    const channelHandle = formatChannelHandleLabel(channel?.youtubeHandle);
    const created = await this.prisma.video.create({
      data: {
        ...fields,
        channelId,
        ...(channelHandle ? { channelHandle } : {}),
        chapters: {
          create: chapters.map((c) => ({
            title: c.title,
            startTimestamp: c.startTimestamp,
            endTimestamp: c.endTimestamp,
            order: c.order,
            source: 'youtube',
          })),
        },
        snapshots: { create: { views: v.viewsAtResearch } },
      },
    });
    return created.id;
  }
}
