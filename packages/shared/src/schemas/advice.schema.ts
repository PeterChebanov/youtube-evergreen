import { z } from 'zod';
import { periodFilterSchema } from '../advice/period';
import { llmModelOverridesSchema } from '../llm/overrides-schema';

const adviceTopicDraftSchema = z.object({
  type: z.enum(['rework', 'analog']),
  title: z.string().min(1),
  topic: z.string().min(1),
  subtopic: z.string().optional(),
  genre: z.string().optional(),
  rationale: z.string().min(1),
  sourceVideoIds: z.array(z.string()).min(1),
  draftChapters: z
    .array(z.object({ title: z.string(), subIdeas: z.array(z.string()).default([]) }))
    .min(3),
  riddle: z.string().min(1),
});

/** REQUIREMENTS 2.9: always one rework and two analogues. */
export const adviceDraftSchema = z
  .object({ topics: z.array(adviceTopicDraftSchema).length(3) })
  .refine((d) => d.topics.filter((t) => t.type === 'rework').length === 1, {
    message: 'exactly one topic must be a rework',
    path: ['topics'],
  });

export type AdviceDraft = z.infer<typeof adviceDraftSchema>;

export const adviceFiltersSchema = z.object({
  period: periodFilterSchema.optional(),
  genreIds: z.array(z.string()).default([]),
  theme: z.string().optional(),
  skipMyVideos: z.boolean().default(true),
  language: z.enum(['ru', 'en']).default('ru'),
  targetDurationMin: z.number().int().min(30).max(90).default(52),
  llmModelOverrides: llmModelOverridesSchema.optional(),
});

export type AdviceFilters = z.infer<typeof adviceFiltersSchema>;

export const adviceSourceSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelName: z.string(),
  views: z.number(),
  durationSec: z.number(),
  publishedAt: z.string(),
  velocityPerDay: z.number(),
  relativeSuccess: z.number(),
});

export const adviceTopicSchema = adviceTopicDraftSchema.extend({
  sources: z.array(adviceSourceSchema),
});

export const adviceRunResultSchema = z.object({
  runId: z.string(),
  topics: z.array(adviceTopicSchema).length(3),
  warnings: z.array(z.string()),
});

export type AdviceTopic = z.infer<typeof adviceTopicSchema>;
export type AdviceRunResult = z.infer<typeof adviceRunResultSchema>;
