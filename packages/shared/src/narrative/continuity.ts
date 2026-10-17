import { z } from 'zod';

export const chapterContinuitySchema = z.object({
  summary: z.string().min(1),
  termsIntroduced: z.array(z.string()).default([]),
  imagesUsed: z.array(z.string()).default([]),
  mechanismsExplained: z.array(z.string()).default([]),
  recurringCastUpdates: z.array(z.string()).default([]),
});

export type ChapterContinuity = z.infer<typeof chapterContinuitySchema>;

export function serializeContinuity(data: ChapterContinuity): string {
  return JSON.stringify(data);
}

/** Reads continuity JSON from `summary`; plain-text summaries from older runs still work. */
export function parseContinuity(raw: string | null | undefined): ChapterContinuity | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    const parsed = chapterContinuitySchema.safeParse(JSON.parse(trimmed));
    return parsed.success ? parsed.data : { summary: trimmed, termsIntroduced: [], imagesUsed: [], mechanismsExplained: [], recurringCastUpdates: [] };
  }
  return { summary: trimmed, termsIntroduced: [], imagesUsed: [], mechanismsExplained: [], recurringCastUpdates: [] };
}

export function mergeContinuityForWriter(rows: ChapterContinuity[]): {
  priorSummaries: string[];
  termsIntroduced: string[];
  imagesUsed: string[];
  mechanismsExplained: string[];
  recurringCastUpdates: string[];
} {
  const terms = new Set<string>();
  const images = new Set<string>();
  const mechanisms = new Set<string>();
  const cast = new Set<string>();
  const priorSummaries: string[] = [];
  for (const r of rows) {
    priorSummaries.push(r.summary);
    r.termsIntroduced.forEach((t) => terms.add(t));
    r.imagesUsed.forEach((t) => images.add(t));
    r.mechanismsExplained.forEach((t) => mechanisms.add(t));
    r.recurringCastUpdates.forEach((t) => cast.add(t));
  }
  return {
    priorSummaries,
    termsIntroduced: [...terms],
    imagesUsed: [...images],
    mechanismsExplained: [...mechanisms],
    recurringCastUpdates: [...cast],
  };
}
