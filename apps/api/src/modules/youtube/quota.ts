/** YouTube Data API v3 unit costs for the calls we make. */
export const QUOTA_COST = { channels: 1, playlistItems: 1, videos: 1, search: 100 } as const;

const QUOTA_TZ = 'America/Los_Angeles';

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The quota day (YYYY-MM-DD) as YouTube counts it: Pacific Time. */
export function quotaDay(now: Date): string {
  const p = zonedParts(now, QUOTA_TZ);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Next Pacific midnight, when the daily quota resets. */
export function nextQuotaReset(now: Date): Date {
  const p = zonedParts(now, QUOTA_TZ);
  const midnightAsUtc = Date.UTC(p.y, p.m - 1, p.d + 1);
  const guess = new Date(midnightAsUtc - offsetMs(new Date(midnightAsUtc), QUOTA_TZ));
  return new Date(midnightAsUtc - offsetMs(guess, QUOTA_TZ));
}

export class QuotaExceededError extends Error {
  constructor(readonly resetAt: Date) {
    super(`YouTube API daily quota exhausted; resumes at ${resetAt.toISOString()}`);
    this.name = 'QuotaExceededError';
  }
}
