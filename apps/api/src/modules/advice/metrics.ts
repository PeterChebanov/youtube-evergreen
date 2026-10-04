const DAY_MS = 86_400_000;

export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const ageDays = (publishedAt: Date, now: Date) => Math.max(1, (now.getTime() - publishedAt.getTime()) / DAY_MS);

/** Views per day over the video's whole life (REQUIREMENTS 2.4). */
export const lifetimeVelocity = (views: number, publishedAt: Date, now: Date) => views / ageDays(publishedAt, now);

/** Views per day between the first and last research snapshot; null with fewer than two points a day apart. */
export function snapshotVelocity(snapshots: ReadonlyArray<{ researchedAt: Date; views: number }>): number | null {
  if (snapshots.length < 2) return null;
  const s = [...snapshots].sort((a, b) => a.researchedAt.getTime() - b.researchedAt.getTime());
  const first = s[0];
  const last = s[s.length - 1];
  const days = (last.researchedAt.getTime() - first.researchedAt.getTime()) / DAY_MS;
  return days >= 1 ? Math.max(0, (last.views - first.views) / days) : null;
}

/** Success relative to the channel's own median, so small channels' hits are not drowned by big channels. */
export const relativeSuccess = (views: number, channelMedian: number) => (channelMedian > 0 ? views / channelMedian : 0);
