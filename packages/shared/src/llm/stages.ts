/** Every AI step the user can assign an LLM vendor to. */
export const LLM_STAGE_IDS = [
  'video_basic',
  'video_structure',
  'author_style',
  'transcript_analysis',
  'genre_practices',
  'channel_style',
  'advice',
  'plan_shallow_queries',
  'planning',
  'fact_research_queries',
  'fact_extract',
  'writer',
  'writer_refine',
  'chapter_summary',
] as const;

export type LlmStageId = (typeof LLM_STAGE_IDS)[number];

/** @deprecated use LLM_STAGE_IDS */
export const PROJECT_LLM_STAGE_IDS = [
  'planning',
  'plan_shallow_queries',
  'fact_research_queries',
  'fact_extract',
  'writer',
  'writer_refine',
  'chapter_summary',
] as const satisfies readonly LlmStageId[];

export type ProjectLlmStageId = (typeof PROJECT_LLM_STAGE_IDS)[number];

export const LLM_STAGES: ReadonlyArray<{ id: LlmStageId; label: string; hint: string; projectScoped: boolean }> = [
  { id: 'video_basic', label: 'Channel video analysis', hint: 'After YouTube collect — per-video JSON analysis', projectScoped: false },
  { id: 'video_structure', label: 'Video structure', hint: 'Chapters / structure from description or transcript', projectScoped: false },
  { id: 'author_style', label: 'Author style', hint: 'Channel author techniques after analyze', projectScoped: false },
  { id: 'transcript_analysis', label: 'Transcript analysis', hint: 'Subtitles tab tone analysis', projectScoped: false },
  { id: 'genre_practices', label: 'Genre practices', hint: 'After channel research — genre modules', projectScoped: false },
  { id: 'channel_style', label: 'Channel style draft', hint: 'Style & genres screen', projectScoped: false },
  { id: 'advice', label: 'Advice topics', hint: '3 topic suggestions', projectScoped: false },
  { id: 'plan_shallow_queries', label: 'Plan shallow search', hint: 'Queries before first plan draft', projectScoped: true },
  { id: 'planning', label: 'Plan', hint: 'Outline and chapters', projectScoped: true },
  { id: 'fact_research_queries', label: 'Fact search queries', hint: 'Queries per chapter in fact pipeline', projectScoped: true },
  { id: 'fact_extract', label: 'Fact extraction', hint: 'Facts from fetched pages', projectScoped: true },
  { id: 'writer', label: 'Writer chapter', hint: 'Draft chapter text', projectScoped: true },
  { id: 'writer_refine', label: 'Writer refine', hint: 'Rewrite after feedback', projectScoped: true },
  { id: 'chapter_summary', label: 'Chapter summary', hint: 'Summary for next chapters', projectScoped: true },
];

export const PROJECT_LLM_STAGES = LLM_STAGES.filter((s) => s.projectScoped);

/** LLM steps during channel research (stored on ResearchJob). */
export const CHANNEL_RESEARCH_STAGE_IDS = [
  'video_basic',
  'video_structure',
  'author_style',
  'genre_practices',
] as const satisfies readonly LlmStageId[];

export function vendorOverridesForStages(
  vendor: string,
  stages: readonly LlmStageId[],
): Partial<Record<LlmStageId, string>> {
  const v = vendor.trim();
  if (!v) return {};
  return Object.fromEntries(stages.map((id) => [id, v])) as Partial<Record<LlmStageId, string>>;
}
