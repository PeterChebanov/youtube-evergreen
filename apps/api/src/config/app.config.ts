import { join } from 'node:path';
import { PROMPT_NAMES, PromptName } from '../modules/llm/prompt-names';

const DEFAULT_MODELS: Record<PromptName, string> = {
  video_basic: 'gpt-4o-mini',
  video_structure: 'gpt-4o-mini',
  author_style: 'gpt-4o-mini',
  genre_practices: 'gpt-4o-mini',
  channel_style: 'gpt-4o',
  transcript_analysis: 'gpt-4o-mini',
  advice: 'gpt-4o',
  planning: 'gpt-4o',
  research_queries: 'gpt-4o-mini',
  fact_extract: 'gpt-4o-mini',
  writer: 'gpt-4o',
  writer_refine: 'gpt-4o',
  chapter_summary: 'gpt-4o-mini',
};

const str = (name: string, fallback = '') => process.env[name]?.trim() || fallback;
const int = (name: string, fallback: number) => {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
};
const num = (name: string, fallback: number) => {
  const v = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(v) ? v : fallback;
};

export type AppConfig = ReturnType<typeof appConfig>;

export const appConfig = () => ({
  port: int('PORT', 3000),
  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),
  promptsDir: str('PROMPTS_DIR', join(__dirname, '..', 'prompts')),
  llm: {
    provider: str('LLM_PROVIDER') === 'openai' ? ('openai' as const) : ('mock' as const),
    openaiApiKey: str('OPENAI_API_KEY'),
    models: Object.fromEntries(
      PROMPT_NAMES.map((p) => [p, str(`LLM_MODEL_${p.toUpperCase()}`, str('LLM_MODEL_DEFAULT', DEFAULT_MODELS[p]))]),
    ) as Record<PromptName, string>,
    embeddingModel: str('LLM_EMBEDDING_MODEL', 'text-embedding-3-small'),
    priceInputPer1M: num('LLM_PRICE_INPUT_PER_1M', 0.15),
    priceOutputPer1M: num('LLM_PRICE_OUTPUT_PER_1M', 0.6),
    estInputTokensPerVideo: int('LLM_EST_INPUT_TOKENS_PER_VIDEO', 350),
    estOutputTokensPerVideo: int('LLM_EST_OUTPUT_TOKENS_PER_VIDEO', 120),
  },
  youtube: {
    apiKey: str('YOUTUBE_API_KEY'),
    dailyQuotaUnits: int('YOUTUBE_DAILY_QUOTA_UNITS', 10000),
    quotaReserveUnits: int('YOUTUBE_QUOTA_RESERVE_UNITS', 200),
    shortsMinDurationSec: int('SHORTS_MIN_DURATION_SEC', 60),
  },
  subtitles: {
    provider: str('SUBTITLES_PROVIDER') === 'mock' ? ('mock' as const) : ('ytdlp' as const),
    ytdlpPath: str('YTDLP_PATH', 'yt-dlp'),
    delayMs: int('YTDLP_DELAY_MS', 3000),
    maxRetries: int('YTDLP_MAX_RETRIES', 3),
    proxy: str('YTDLP_PROXY'),
    cookiesFile: str('YTDLP_COOKIES_FILE'),
    langs: str('YTDLP_SUB_LANGS', 'ru,en').split(',').map((l) => l.trim()).filter(Boolean),
  },
  search: {
    tavilyApiKey: str('TAVILY_API_KEY'),
    braveApiKey: str('BRAVE_API_KEY'),
    perplexityApiKey: str('PERPLEXITY_API_KEY'),
    redditClientId: str('REDDIT_CLIENT_ID'),
    redditClientSecret: str('REDDIT_CLIENT_SECRET'),
    resultsPerQuery: int('SEARCH_RESULTS_PER_QUERY', 5),
    maxPagesPerChapter: int('SEARCH_MAX_PAGES_PER_CHAPTER', 6),
    fetchTimeoutMs: int('SEARCH_FETCH_TIMEOUT_MS', 10000),
  },
});
