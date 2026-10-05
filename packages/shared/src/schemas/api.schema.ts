import { z } from 'zod';
import { PROJECT_STATUSES } from '../projects/project-status';
import { llmModelOverridesSchema } from '../llm/overrides-schema';
import { LLM_STAGE_IDS } from '../llm/stages';
import { LLM_VENDOR_IDS } from '../llm/vendors';
import { SEARCH_PROVIDER_IDS } from '../search/providers';
import { FACT_RELATIONS } from './writer.schema';

export const CHANNEL_STATUSES = ['collecting', 'analyzing', 'ready', 'analysis_failed', 'partial'] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];

export const channelSummarySchema = z.object({
  id: z.string(),
  youtubeChannelId: z.string(),
  channelName: z.string(),
  youtubeUrl: z.string(),
  researchStatus: z.enum(CHANNEL_STATUSES),
  analysisError: z.string().nullable(),
  lastResearchedAt: z.string().nullable(),
  videoCount: z.number().int(),
  analyzedCount: z.number().int(),
  job: z
    .object({
      id: z.string(),
      status: z.string(),
      stage: z.string(),
      progress: z.number(),
      error: z.string().nullable(),
      pausedUntil: z.string().nullable(),
    })
    .nullable(),
});

export type ChannelSummary = z.infer<typeof channelSummarySchema>;

export const channelDetailSchema = z.object({
  id: z.string(),
  channelName: z.string(),
  stats: z.object({
    videoCount: z.number(),
    medianViews: z.number(),
    averageDurationSec: z.number(),
    chaptersPerVideo: z.number(),
  }),
  authorStyles: z.array(
    z.object({ id: z.string(), technique: z.string(), description: z.string(), order: z.number() }),
  ),
});

export type ChannelDetail = z.infer<typeof channelDetailSchema>;

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  entryType: z.enum(['advice', 'own_request']),
  status: z.enum(PROJECT_STATUSES),
  language: z.enum(['ru', 'en']),
  targetDurationMin: z.number(),
  genreId: z.string().nullable(),
  authorOverlayChannelId: z.string().nullable(),
  toneReferenceVideoIds: z.array(z.string()),
  useDatabase: z.boolean(),
  topic: z.string().nullable(),
  searchProviders: z.array(z.enum(SEARCH_PROVIDER_IDS)),
  llmModelOverrides: llmModelOverridesSchema,
});

export const searchOptionSchema = z.object({
  id: z.enum(SEARCH_PROVIDER_IDS),
  label: z.string(),
  configured: z.boolean(),
});
export type SearchOption = z.infer<typeof searchOptionSchema>;

export const llmDefaultsSchema = z.object({
  researchModel: z.string(),
  writerModel: z.string(),
});
export type LlmDefaults = z.infer<typeof llmDefaultsSchema>;

export const llmVendorOptionSchema = z.object({
  id: z.enum(LLM_VENDOR_IDS),
  label: z.string(),
  modelRef: z.string().nullable(),
  configured: z.boolean(),
});

export const llmStageOptionSchema = z.object({
  id: z.enum(LLM_STAGE_IDS),
  label: z.string(),
  hint: z.string(),
  projectScoped: z.boolean(),
  defaultVendor: z.enum(LLM_VENDOR_IDS).nullable(),
  defaultModel: z.string(),
});

export const llmCatalogSchema = z.object({
  vendors: z.array(llmVendorOptionSchema),
  stages: z.array(llmStageOptionSchema),
});
export type LlmCatalog = z.infer<typeof llmCatalogSchema>;

export type ProjectDto = z.infer<typeof projectSchema>;

export const factSchema = z.object({
  id: z.string(),
  planChapterOrder: z.number(),
  iteration: z.number(),
  text: z.string(),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().nullable(),
  relations: z.array(z.object({ factId: z.string(), kind: z.enum(FACT_RELATIONS) })),
});

export type FactDto = z.infer<typeof factSchema>;

export const CHAPTER_WORK_STATES = ['queued', 'run', 'done', 'failed'] as const;

export const factResearchStateSchema = z.object({
  jobId: z.string().nullable(),
  status: z.string(),
  chapters: z.array(
    z.object({ order: z.number(), title: z.string(), state: z.enum(CHAPTER_WORK_STATES), factCount: z.number() }),
  ),
  facts: z.array(factSchema),
});

export type FactResearchState = z.infer<typeof factResearchStateSchema>;

export const scriptChapterSchema = z.object({
  chapterOrder: z.number(),
  title: z.string(),
  version: z.number(),
  text: z.string(),
  summary: z.string().nullable(),
  status: z.enum(['todo', 'draft', 'approved']),
});

export const writerStateSchema = z.object({
  chapters: z.array(scriptChapterSchema),
  toneFromSubtitles: z.boolean(),
  canFinalize: z.boolean(),
});

export type WriterState = z.infer<typeof writerStateSchema>;

export const SUBTITLE_SCENARIOS = [
  'match',
  'title_mismatch',
  'already_exists',
  'not_in_db_channel_exists',
  'not_in_db_channel_missing',
] as const;

export type SubtitleScenario = (typeof SUBTITLE_SCENARIOS)[number];

export const subtitleCheckSchema = z.object({
  scenario: z.enum(SUBTITLE_SCENARIOS),
  youtubeVideoId: z.string(),
  youtubeTitle: z.string(),
  dbTitle: z.string().nullable(),
  youtubeChannelId: z.string(),
  channelName: z.string(),
  channelInDb: z.boolean(),
  channelStatus: z.string().nullable(),
  channelVideoCount: z.number().nullable(),
  durationSec: z.number(),
  videoId: z.string().nullable(),
  transcriptStatus: z.string().nullable(),
  transcriptAnalysis: z.record(z.unknown()).nullable(),
});

export type SubtitleCheck = z.infer<typeof subtitleCheckSchema>;

export const opsStatusSchema = z.object({
  api: z.literal('ok'),
  queues: z.object({ running: z.number(), queued: z.number() }),
  youtubeQuota: z.object({ used: z.number(), limit: z.number() }),
  llmSpendTodayUsd: z.number(),
  videoCount: z.number(),
  styleUpdateSuggested: z.boolean(),
});

export type OpsStatus = z.infer<typeof opsStatusSchema>;

export const topicMemorySchema = z.object({
  indexed: z.number().int(),
  total: z.number().int(),
  closestPair: z
    .object({
      a: z.object({ id: z.string(), title: z.string() }),
      b: z.object({ id: z.string(), title: z.string() }),
      similarity: z.number(),
    })
    .nullable(),
});

export type TopicMemory = z.infer<typeof topicMemorySchema>;
