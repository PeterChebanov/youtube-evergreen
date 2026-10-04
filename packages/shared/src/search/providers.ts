/** Search backends for fact research and shallow plan research. */
export const SEARCH_PROVIDER_IDS = ['tavily', 'brave', 'reddit', 'perplexity'] as const;
export type SearchProviderId = (typeof SEARCH_PROVIDER_IDS)[number];

export const SEARCH_PROVIDER_LABELS: Record<SearchProviderId, string> = {
  tavily: 'Tavily',
  brave: 'Brave Search',
  reddit: 'Reddit',
  perplexity: 'Perplexity',
};

/** LLM prompts that use the per-project research model override. */
export const RESEARCH_LLM_PROMPTS = ['research_queries', 'fact_extract', 'planning'] as const;

/** LLM prompts that use the per-project writer (author) model override. */
export const WRITER_LLM_PROMPTS = ['writer', 'writer_refine', 'chapter_summary'] as const;
