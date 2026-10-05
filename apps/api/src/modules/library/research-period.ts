import {
  hasResearchPeriod,
  parseResearchPeriod,
  type ResearchPeriod,
  type ResearchPeriodInput,
  videoPublishedInPeriod,
} from '@youtube-ai-tool/shared';
import type { ResearchJob } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { isLongForm } from './video-sync';
import type { YoutubeVideo } from '../youtube/youtube.gateway';
import type { YoutubeService } from '../youtube/youtube.service';

export { parseResearchPeriod, hasResearchPeriod, videoPublishedInPeriod };
export type { ResearchPeriod, ResearchPeriodInput };

export function periodFromJob(job: Pick<ResearchJob, 'publishedAfter' | 'publishedBefore'>): ResearchPeriod {
  return {
    publishedAfter: job.publishedAfter ?? null,
    publishedBefore: job.publishedBefore ?? null,
  };
}

export function videoPeriodWhere(channelId: string, period: ResearchPeriod): Prisma.VideoWhereInput {
  const publishedAt: Prisma.DateTimeFilter = {};
  if (period.publishedAfter) publishedAt.gte = period.publishedAfter;
  if (period.publishedBefore) publishedAt.lte = period.publishedBefore;
  return { channelId, ...(Object.keys(publishedAt).length ? { publishedAt } : {}) };
}

/** Walk uploads playlist (newest first) and count long-form videos in range. */
export async function countLongFormInPeriod(
  youtube: YoutubeService,
  uploadsPlaylistId: string,
  period: ResearchPeriod,
  minDurationSec: number,
): Promise<number> {
  if (!hasResearchPeriod(period)) return 0;
  let cursor: string | null = null;
  let count = 0;
  let first = true;
  while (first || cursor) {
    first = false;
    const page = await youtube.listUploads(uploadsPlaylistId, cursor);
    if (!page.videoIds.length) break;
    const videos = await youtube.getVideos(page.videoIds);
    let stop = false;
    for (const v of videos) {
      if (!videoPublishedInPeriod(v.publishedAt, period)) {
        if (period.publishedAfter && v.publishedAt < period.publishedAfter) stop = true;
        continue;
      }
      if (isLongForm(v, minDurationSec)) count++;
    }
    if (stop) break;
    cursor = page.nextPageToken;
  }
  return count;
}

export function filterVideosForPeriod(videos: YoutubeVideo[], period: ResearchPeriod): YoutubeVideo[] {
  if (!hasResearchPeriod(period)) return videos;
  return videos.filter((v) => videoPublishedInPeriod(v.publishedAt, period));
}

/** True when playlist page is entirely older than the range (newest-first order). */
export function pageEntirelyBeforePeriod(videos: YoutubeVideo[], period: ResearchPeriod): boolean {
  if (!period.publishedAfter || !videos.length) return false;
  return videos.every((v) => v.publishedAt < period.publishedAfter);
}
