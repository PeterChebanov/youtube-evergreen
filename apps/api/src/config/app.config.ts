import { join } from 'node:path';
import { formatModelRef, vendorModelRefFromEnv, type LlmStageId, type LlmVendorId } from '@youtube-ai-tool/shared';
import type { PromptName } from '../modules/llm/prompt-names';

const str = (name: string, fallback = '') => process.env[name]?.trim() || fallback;
const int = (name: string, fallback: number) => {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
};
const num = (name: string, fallback: number) => {
  const v = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(v) ? v : fallback;
};

const VENDOR_ORDER = ['perplexity', 'anthropic', 'openai', 'gemini', 'xai'] as const;

function buildLlmBlock() {
  const providers = {
    openai: {
      apiKey: str('OPENAI_API_KEY'),
      baseUrl: str('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      model: str('OPENAI_MODEL', 'gpt-4o-mini'),
    },
    gemini: {
      apiKey: str('GEMINI_API_KEY'),
      baseUrl: str('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
      model: str('GEMINI_MODEL', 'gemini-2.0-flash'),
    },
    xai: {
      apiKey: str('XAI_API_KEY'),
      baseUrl: str('XAI_BASE_URL', 'https://api.x.ai/v1'),
      model: str('XAI_MODEL', 'grok-2-latest'),
    },
    anthropic: {
      apiKey: str('ANTHROPIC_API_KEY'),
      baseUrl: str('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
      apiVersion: str('ANTHROPIC_VERSION', '2023-06-01'),
      maxTokens: int('ANTHROPIC_MAX_TOKENS', 8192),
      model: str('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929'),
    },
    perplexity: {
      apiKey: str('PERPLEXITY_API_KEY'),
      baseUrl: str('PERPLEXITY_BASE_URL', 'https://api.perplexity.ai'),
      model: str('PERPLEXITY_MODEL', 'sonar-pro'),
    },
  };

  const llm = {
    providers,
    embeddingModel: str('LLM_EMBEDDING_MODEL', 'text-embedding-3-small'),
    priceInputPer1M: num('LLM_PRICE_INPUT_PER_1M', 0.15),
    priceOutputPer1M: num('LLM_PRICE_OUTPUT_PER_1M', 0.6),
    estInputTokensPerVideo: int('LLM_EST_INPUT_TOKENS_PER_VIDEO', 350),
    estOutputTokensPerVideo: int('LLM_EST_OUTPUT_TOKENS_PER_VIDEO', 120),
  };

  const envVendors = {
    openai: { apiKey: providers.openai.apiKey, model: providers.openai.model },
    anthropic: { apiKey: providers.anthropic.apiKey, model: providers.anthropic.model },
    gemini: { apiKey: providers.gemini.apiKey, model: providers.gemini.model },
    xai: { apiKey: providers.xai.apiKey, model: providers.xai.model },
    perplexity: { apiKey: providers.perplexity.apiKey, model: providers.perplexity.model },
  };

  const pick = (...vendors: LlmVendorId[]): string => {
    for (const v of vendors) {
      const ref = vendorModelRefFromEnv(envVendors, v);
      if (ref) return ref;
    }
    for (const v of VENDOR_ORDER) {
      const ref = vendorModelRefFromEnv(envVendors, v);
      if (ref) return ref;
    }
    return formatModelRef('openai', 'gpt-4o-mini');
  };

  const research = pick('perplexity', 'openai', 'anthropic', 'gemini', 'xai');
  const writer = pick('anthropic', 'openai', 'gemini', 'xai', 'perplexity');
  const general = pick('anthropic', 'openai', 'gemini', 'xai', 'perplexity');

  const stageDefaults: Record<LlmStageId, string> = {
    video_basic: general,
    video_structure: general,
    author_style: general,
    transcript_analysis: general,
    genre_practices: general,
    channel_style: general,
    advice: general,
    plan_shallow_queries: research,
    planning: research,
    fact_research_queries: research,
    fact_extract: research,
    writer,
    writer_refine: writer,
    chapter_summary: pick('anthropic', 'openai', 'gemini', 'xai', 'perplexity'),
  };

  const models: Record<PromptName, string> = {
    video_basic: stageDefaults.video_basic,
    video_structure: stageDefaults.video_structure,
    author_style: stageDefaults.author_style,
    genre_practices: stageDefaults.genre_practices,
    channel_style: stageDefaults.channel_style,
    transcript_analysis: stageDefaults.transcript_analysis,
    advice: stageDefaults.advice,
    planning: stageDefaults.planning,
    research_queries: stageDefaults.plan_shallow_queries,
    fact_extract: stageDefaults.fact_extract,
    writer: stageDefaults.writer,
    writer_refine: stageDefaults.writer_refine,
    writer_snippet_refine: stageDefaults.writer_refine,
    chapter_summary: stageDefaults.chapter_summary,
  };

  const hasAnyKey = VENDOR_ORDER.some((v) => vendorModelRefFromEnv(envVendors, v));
  const mode = str('LLM_PROVIDER') === 'mock' || !hasAnyKey ? ('mock' as const) : ('live' as const);

  return { ...llm, mode, stageDefaults, models };
}

export type AppConfig = ReturnType<typeof appConfig>;

export const appConfig = () => ({
  port: int('PORT', 3000),
  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),
  promptsDir: str('PROMPTS_DIR', join(__dirname, '..', 'prompts')),
  llm: buildLlmBlock(),
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
