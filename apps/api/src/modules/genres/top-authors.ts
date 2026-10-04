import { median, relativeSuccess } from '../advice/metrics';

export type GenreVideo = { channelId: string; channelName: string; views: number };

export type TopAuthor = { channelId: string; channelName: string; medianRelativeSuccess: number; videoCount: number };

/**
 * Authors strongest in a genre by data (REQUIREMENTS G.6): median success of
 * their videos in the genre relative to their own channel median.
 */
export function rankTopAuthors(
  videos: GenreVideo[],
  channelMedians: ReadonlyMap<string, number>,
  { limit = 3, minVideos = 2 } = {},
): TopAuthor[] {
  const byChannel = new Map<string, { name: string; scores: number[] }>();
  for (const v of videos) {
    const entry = byChannel.get(v.channelId) ?? { name: v.channelName, scores: [] };
    entry.scores.push(relativeSuccess(v.views, channelMedians.get(v.channelId) ?? 0));
    byChannel.set(v.channelId, entry);
  }
  return [...byChannel.entries()]
    .filter(([, e]) => e.scores.length >= minVideos)
    .map(([channelId, e]) => ({
      channelId,
      channelName: e.name,
      medianRelativeSuccess: Math.round(median(e.scores) * 100) / 100,
      videoCount: e.scores.length,
    }))
    .sort((a, b) => b.medianRelativeSuccess - a.medianRelativeSuccess || b.videoCount - a.videoCount)
    .slice(0, limit);
}
