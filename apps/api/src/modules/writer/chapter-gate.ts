import { conflict } from '../../common/domain-error';

/** First chapter that is not approved yet; null when the script is complete. */
export function nextWritableChapter(chapterCount: number, approved: ReadonlySet<number>): number | null {
  for (let order = 1; order <= chapterCount; order++) if (!approved.has(order)) return order;
  return null;
}

/** REQUIREMENTS 5.6: chapter N is written only after chapters 1..N-1 are approved. */
export function assertCanWriteChapter(order: number, chapterCount: number, approved: ReadonlySet<number>): void {
  if (order < 1 || order > chapterCount) throw conflict(`The plan has no chapter ${order}`);
  if (approved.has(order)) throw conflict(`Chapter ${order} is already approved`);
  const next = nextWritableChapter(chapterCount, approved);
  if (next !== order) throw conflict(`Approve chapter ${next} before writing chapter ${order}`);
}
