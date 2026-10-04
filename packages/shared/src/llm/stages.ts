/** Pipeline prompts the user can override per project (Plan → Facts → Writer). */
export const PROJECT_LLM_STAGE_IDS = [
  'planning',
  'research_queries',
  'fact_extract',
  'writer',
  'writer_refine',
  'chapter_summary',
] as const;

export type ProjectLlmStageId = (typeof PROJECT_LLM_STAGE_IDS)[number];

export const PROJECT_LLM_STAGES: ReadonlyArray<{ id: ProjectLlmStageId; label: string; hint: string }> = [
  { id: 'planning', label: 'Plan', hint: 'Outline and chapters (may use DB tools)' },
  { id: 'research_queries', label: 'Search queries', hint: 'Queries for shallow plan research and fact pipeline' },
  { id: 'fact_extract', label: 'Fact extraction', hint: 'Facts from fetched pages (may use DB tools)' },
  { id: 'writer', label: 'Writer chapter', hint: 'Draft chapter text' },
  { id: 'writer_refine', label: 'Writer refine', hint: 'Every refine pass (can differ from draft model)' },
  { id: 'chapter_summary', label: 'Chapter summary', hint: 'Short summary for next chapters' },
];
