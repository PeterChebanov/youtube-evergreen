import { z } from 'zod';

const planChapterDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  lengthMin: z.number().positive(),
  subpoints: z.array(z.string()).default([]),
  hooks: z.array(z.string()).default([]),
  techniques: z.array(z.string()).default([]),
  ending: z.string().default(''),
  bridge: z.string().default(''),
  /** What earlier chapters already established that this chapter builds on (not repeats). */
  buildsOn: z.string().default(''),
  /** Beats, images, or explanations that must not appear again in this chapter. */
  doNotRepeat: z.array(z.string()).default([]),
});

const recurringCastSchema = z.object({
  label: z.string().min(1),
  role: z.string().min(1),
  returnInFinal: z.boolean().default(false),
});

const riddleSchema = z.object({
  question: z.string().min(1),
  plantMin: z.number().min(0),
  answerMin: z.number().positive(),
});

/** What the planning prompt returns. Timing is normalised by code afterwards. */
export const planDraftSchema = z
  .object({
    riddle: riddleSchema,
    /** One attack model for the whole video; do not introduce competing taxonomies in chapters. */
    narrativeFramework: z.string().min(1),
    recurringCast: z.array(recurringCastSchema).default([]),
    chapters: z.array(planChapterDraftSchema).min(1),
    dbDataUsed: z.array(z.string()).default([]),
  })
  .refine((p) => p.riddle.plantMin < p.riddle.answerMin, {
    message: 'riddle must be planted before it is answered',
    path: ['riddle'],
  });

export const planChapterSchema = planChapterDraftSchema.extend({
  order: z.number().int().positive(),
  startMin: z.number().min(0),
});

export const planContentSchema = z.object({
  targetDurationMin: z.number().int().positive(),
  riddle: riddleSchema,
  narrativeFramework: z
    .string()
    .min(1)
    .default('False role, emotion, time pressure, isolation; antidote = pause and independent verification.'),
  recurringCast: z.array(recurringCastSchema).default([]),
  chapters: z.array(planChapterSchema).min(1),
  dbDataUsed: z.array(z.string()).default([]),
});

export type PlanDraft = z.infer<typeof planDraftSchema>;
export type PlanContent = z.infer<typeof planContentSchema>;
export type PlanChapter = z.infer<typeof planChapterSchema>;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Sum of chapter lengths (actual timeline length after manual edits). */
export function planTotalDurationMin(plan: Pick<PlanContent, 'chapters'>): number {
  return round1(plan.chapters.reduce((sum, c) => sum + c.lengthMin, 0));
}

/**
 * Manual plan edits: keep each chapter's lengthMin, renumber orders, recompute startMin.
 * Does not rescale lengths to targetDurationMin.
 */
export function applyManualPlanTiming(
  draft: Pick<PlanDraft, 'riddle' | 'chapters' | 'narrativeFramework' | 'recurringCast'> & { dbDataUsed?: string[] },
  targetDurationMin: number,
): PlanContent {
  let start = 0;
  const chapters = draft.chapters.map((c, i) => {
    const lengthMin = round1(c.lengthMin);
    const chapter = { ...c, order: i + 1, startMin: round1(start), lengthMin };
    start += lengthMin;
    return chapter;
  });

  const totalDurationMin = round1(start) || targetDurationMin;
  const clamp = (v: number) => Math.min(Math.max(round1(v), 0), totalDurationMin);
  let plantMin = clamp(draft.riddle.plantMin);
  let answerMin = clamp(draft.riddle.answerMin);
  if (plantMin >= answerMin) {
    plantMin = 0;
    answerMin = Math.max(totalDurationMin, draft.riddle.answerMin);
    if (plantMin >= answerMin) answerMin = Math.max(0.1, totalDurationMin);
  }

  return {
    targetDurationMin,
    riddle: { question: draft.riddle.question, plantMin, answerMin },
    narrativeFramework: draft.narrativeFramework,
    recurringCast: draft.recurringCast ?? [],
    chapters,
    dbDataUsed: draft.dbDataUsed ?? [],
  };
}

/**
 * Scales chapter lengths to the target duration, recomputes start times,
 * renumbers chapters and keeps the riddle inside the video.
 */
export function finalizePlan(
  draft: Pick<PlanDraft, 'riddle' | 'chapters' | 'narrativeFramework' | 'recurringCast'> & { dbDataUsed?: string[] },
  targetDurationMin: number,
): PlanContent {
  const total = draft.chapters.reduce((sum, c) => sum + c.lengthMin, 0);
  const scale = total > 0 ? targetDurationMin / total : 1;

  let start = 0;
  const chapters = draft.chapters.map((c, i) => {
    const lengthMin = round1(c.lengthMin * scale);
    const chapter = { ...c, order: i + 1, startMin: round1(start), lengthMin };
    start += lengthMin;
    return chapter;
  });

  const clamp = (v: number) => Math.min(Math.max(round1(v * scale), 0), targetDurationMin);
  let plantMin = clamp(draft.riddle.plantMin);
  let answerMin = clamp(draft.riddle.answerMin);
  if (plantMin >= answerMin) {
    plantMin = 0;
    answerMin = targetDurationMin;
  }

  return {
    targetDurationMin,
    riddle: { question: draft.riddle.question, plantMin, answerMin },
    narrativeFramework: draft.narrativeFramework,
    recurringCast: draft.recurringCast ?? [],
    chapters,
    dbDataUsed: draft.dbDataUsed ?? [],
  };
}
