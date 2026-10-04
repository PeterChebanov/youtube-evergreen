import { parseChaptersFromDescription, ParsedChapter, videoUrl } from '@youtube-ai-tool/shared';
import type { YoutubeVideo } from '../youtube/youtube.gateway';

export const UNAVAILABLE = 'unavailable';

export type NewVideo = {
  youtubeVideoId: string;
  title: string;
  url: string;
  publishedAt: Date;
  viewsAtResearch: number;
  durationSec: number;
  description: string;
  chaptersStatus: 'available' | 'unavailable';
  chapters: ParsedChapter[];
};

export type SyncPlan = {
  create: NewVideo[];
  snapshot: Array<{ videoId: string; views: number }>;
  skippedShorts: number;
};

export const isLongForm = (v: Pick<YoutubeVideo, 'durationSec'>, minDurationSec: number) =>
  v.durationSec >= minDurationSec;

export function toNewVideo(v: YoutubeVideo): NewVideo {
  const chapters = parseChaptersFromDescription(v.description, v.durationSec);
  return {
    youtubeVideoId: v.youtubeVideoId,
    title: v.title,
    url: videoUrl(v.youtubeVideoId),
    publishedAt: v.publishedAt,
    viewsAtResearch: v.views,
    durationSec: v.durationSec,
    description: v.description?.trim() || UNAVAILABLE,
    chaptersStatus: chapters.length ? 'available' : 'unavailable',
    chapters,
  };
}

/**
 * Splits a fetched page into new long-form videos to store and known videos
 * that only get a fresh view snapshot (REQUIREMENTS 1.5, 1.14).
 */
export function planVideoSync(
  fetched: YoutubeVideo[],
  known: ReadonlyMap<string, string>,
  minDurationSec: number,
): SyncPlan {
  const plan: SyncPlan = { create: [], snapshot: [], skippedShorts: 0 };
  const seen = new Set<string>();
  for (const v of fetched) {
    if (seen.has(v.youtubeVideoId)) continue;
    seen.add(v.youtubeVideoId);
    const knownId = known.get(v.youtubeVideoId);
    if (knownId) plan.snapshot.push({ videoId: knownId, views: v.views });
    else if (!isLongForm(v, minDurationSec)) plan.skippedShorts++;
    else plan.create.push(toNewVideo(v));
  }
  return plan;
}
