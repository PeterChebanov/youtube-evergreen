import type { LlmStageId } from './stages';

/** Default stage when caller does not pass `stageId` (ambiguous prompts need explicit stageId). */
export const DEFAULT_STAGE_BY_PROMPT = {
  video_basic: 'video_basic',
  video_structure: 'video_structure',
  author_style: 'author_style',
  transcript_analysis: 'transcript_analysis',
  genre_practices: 'genre_practices',
  channel_style: 'channel_style',
  advice: 'advice',
  planning: 'planning',
  research_queries: 'plan_shallow_queries',
  fact_extract: 'fact_extract',
  writer: 'writer',
  writer_refine: 'writer_refine',
  chapter_summary: 'chapter_summary',
} as const satisfies Record<string, LlmStageId>;
