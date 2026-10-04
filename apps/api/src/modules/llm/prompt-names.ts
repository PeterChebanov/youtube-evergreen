export const PROMPT_NAMES = [
  'video_basic',
  'video_structure',
  'author_style',
  'genre_practices',
  'channel_style',
  'transcript_analysis',
  'advice',
  'planning',
  'research_queries',
  'fact_extract',
  'writer',
  'writer_refine',
  'chapter_summary',
] as const;

export type PromptName = (typeof PROMPT_NAMES)[number];
