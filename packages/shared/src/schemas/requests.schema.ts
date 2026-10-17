import { z } from 'zod';
import { targetDurationMinSchema } from '../video/target-duration';
import { llmModelOverridesSchema } from '../llm/overrides-schema';
import { LLM_STAGE_IDS } from '../llm/stages';
import { LLM_VENDOR_IDS } from '../llm/vendors';
import { SEARCH_PROVIDER_IDS } from '../search/providers';
import { researchPeriodFieldsObject, researchPeriodOrderRefine } from '../research/period';
import { adviceTopicSchema } from './advice.schema';
import { planDraftSchema } from './plan.schema';

const text = z.string().trim().min(1);
const language = z.enum(['ru', 'en']);
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'must be an http(s) URL');

const llmVendorSelection = z.enum(LLM_VENDOR_IDS);

export const channelUrlRequestSchema = z.object({
  channelUrl: text,
  llmModelOverrides: llmModelOverridesSchema.optional(),
});

export const startResearchRequestSchema = channelUrlRequestSchema
  .merge(researchPeriodFieldsObject)
  .and(researchPeriodOrderRefine);

export const researchPreviewRequestSchema = startResearchRequestSchema;

export const channelRerunRequestSchema = z.object({
  llmModelOverrides: llmModelOverridesSchema.optional(),
});

export const llmRunOverridesRequestSchema = z.object({
  llmModelOverrides: llmModelOverridesSchema.optional(),
});

export const customRequestSchema = z.object({
  request: text,
  title: z.string().trim().optional(),
  videoUrl: z.string().trim().optional(),
  researchChannelIntoDb: z.boolean().default(false),
  useDatabase: z.boolean().default(false),
  language: language.default('ru'),
  targetDurationMin: targetDurationMinSchema.default(52),
  genreId: z.string().nullable().default(null),
});
export type CustomRequest = z.infer<typeof customRequestSchema>;

export const pickTopicRequestSchema = z.object({
  runId: text,
  topicIndex: z.number().int().min(0).max(2),
});

export const adviceRefineRequestSchema = z.object({
  runId: text,
  topicIndex: z.number().int().min(0).max(2),
  feedback: text,
  llmModelOverrides: llmModelOverridesSchema.optional(),
});

export const adviceTopicRefineResultSchema = z.object({
  runId: z.string(),
  topicIndex: z.number().int().min(0).max(2),
  topic: adviceTopicSchema,
});

export const updateProjectRequestSchema = z
  .object({
    title: text,
    language,
    targetDurationMin: targetDurationMinSchema,
    genreId: z.string().nullable(),
    authorOverlayChannelId: z.string().nullable(),
    toneReferenceVideoIds: z.array(z.string()).max(3),
    useDatabase: z.boolean(),
    searchProviders: z.array(z.enum(SEARCH_PROVIDER_IDS)),
    llmModelOverrides: llmModelOverridesSchema.nullable(),
  })
  .partial();
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const feedbackRequestSchema = z.object({ feedback: text });

export const optionalFeedbackRequestSchema = z.object({
  feedback: z.string().trim().optional(),
});

export const addPlanChapterRequestSchema = z.object({
  insertAfter: z.number().int().min(0),
  description: text,
  lengthMin: z.number().positive(),
  title: z.string().trim().min(1).optional(),
});

export const factRefineRequestSchema = z.object({
  feedback: text,
  chapterOrder: z.number().int().positive().optional(),
});

export const manualPlanRequestSchema = planDraftSchema;

export const addFactRequestSchema = z.object({
  planChapterOrder: z.number().int().positive(),
  text,
  sourceUrl: httpUrl,
  sourceTitle: z.string().trim().optional(),
});

export const chapterTextRequestSchema = z.object({ text });

export const subtitlesCheckRequestSchema = z.object({ url: text });

export const subtitlesAnalyzeRequestSchema = z.object({
  llmModelOverrides: llmModelOverridesSchema.optional(),
});

export const subtitlesFetchRequestSchema = z.object({
  url: text,
  confirmTitleMismatch: z.boolean().default(false),
  confirmAddVideo: z.boolean().default(false),
  confirmOverwrite: z.boolean().default(false),
});
export type SubtitlesFetchRequest = z.infer<typeof subtitlesFetchRequestSchema>;

export const channelStyleRequestSchema = z.object({
  voice: text,
  themes: text,
  techniques: z.array(z.object({ name: text, description: text })),
  retentionRules: text,
});
export type ChannelStyleRequest = z.infer<typeof channelStyleRequestSchema>;

export const genreRequestSchema = z.object({
  name: text,
  focus: text,
  promptModule: z.string().trim().optional(),
  status: z.enum(['approved', 'new']).default('new'),
});
export const genreUpdateRequestSchema = genreRequestSchema.partial();
