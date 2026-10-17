import { z } from 'zod';

/** Narration length bounds for planning, research, and writer (minutes). */
export const TARGET_DURATION_MIN = 8;
export const TARGET_DURATION_MAX = 120;
export const TARGET_DURATION_DEFAULT = 52;

export const NARRATION_WORDS_PER_MINUTE = 140;

export const targetDurationMinSchema = z
  .number()
  .int()
  .min(TARGET_DURATION_MIN)
  .max(TARGET_DURATION_MAX);

export function planChapterCountRange(durationMin: number): { min: number; max: number } {
  if (durationMin <= 15) return { min: 2, max: 4 };
  if (durationMin <= 35) return { min: 3, max: 6 };
  if (durationMin <= 75) return { min: 5, max: 9 };
  return { min: 6, max: 11 };
}

export function targetWordsForVideo(durationMin: number, wpm = NARRATION_WORDS_PER_MINUTE) {
  const mid = durationMin * wpm;
  return {
    target: Math.round(mid),
    min: Math.round(mid * 0.9),
    max: Math.round(mid * 1.1),
  };
}

export function targetWordsForChapter(lengthMin: number, wpm = NARRATION_WORDS_PER_MINUTE): number {
  return Math.round(lengthMin * wpm);
}
