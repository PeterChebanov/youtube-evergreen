import { formatDuration, timestampToSeconds } from './duration';

export type ParsedChapter = {
  order: number;
  title: string;
  startSec: number;
  startTimestamp: string;
  endTimestamp: string | null;
};

const CHAPTER_LINE = /^\s*(?:[-–•*]\s*)?\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:|]?\s*(.+?)\s*$/;
const MIN_CHAPTERS = 3;

/**
 * Chapters as YouTube recognises them: timestamps in the description,
 * the first one at 0:00, at least three, strictly ascending.
 * Anything else is not a chapter list and yields [].
 */
export function parseChaptersFromDescription(
  description: string | null | undefined,
  durationSec?: number,
): ParsedChapter[] {
  if (!description) return [];

  const found: Array<{ title: string; startSec: number }> = [];
  for (const line of description.split(/\r?\n/)) {
    const m = line.match(CHAPTER_LINE);
    if (!m) continue;
    const startSec = timestampToSeconds(m[1]);
    if (Number.isNaN(startSec)) continue;
    found.push({ title: m[2], startSec });
  }

  if (found.length < MIN_CHAPTERS || found[0].startSec !== 0) return [];
  for (let i = 1; i < found.length; i++) {
    if (found[i].startSec <= found[i - 1].startSec) return [];
  }

  return found.map((c, i) => {
    const next = found[i + 1];
    const endSec = next ? next.startSec : durationSec;
    return {
      order: i + 1,
      title: c.title,
      startSec: c.startSec,
      startTimestamp: formatDuration(c.startSec),
      endTimestamp: endSec === undefined ? null : formatDuration(endSec),
    };
  });
}
