import { join } from 'node:path';
import { formatModelRef } from '@youtube-ai-tool/shared';
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

function defaultPipelineModels() {
  const openaiDefault = str('LLM_MODEL_DEFAULT', 'gpt-4o-mini');
  const perplexityModel = str('PERPLEXITY_MODEL', 'sonar-pro');
  const research =
    str('LLM_MODEL_RESEARCH_QUERIES') ||
    (str('PERPLEXITY_API_KEY') ? formatModelRef('perplexity', perplexityModel) : openaiDefault);
  const anthropicSonnet = str('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929');
  const anthropicOpus = str('ANTHROPIC_OPUS_MODEL', 'claude-opus-4-5-20251101');
  const writerAnthropicId = anthropicOpus || anthropicSonnet;
  const writer =
    str('LLM_MODEL_WRITER') ||
    (str('ANTHROPIC_API_KEY') ? formatModelRef('anthropic', writerAnthropicId) : str('LLM_MODEL_DEFAULT', 'gpt-4o'));
  const writerSummary =
    str('LLM_MODEL_CHAPTER_SUMMARY') ||
    (str('ANTHROPIC_API_KEY') ? formatModelRef('anthropic', anthropicSonnet) : openaiDefault);

  const defaults: Record<PromptName, string> = {
    video_basic: str('LLM_MODEL_VIDEO_BASIC', openaiDefault),
    video_structure: str('LLM_MODEL_VIDEO_STRUCTURE', openaiDefault),
    author_style: str('LLM_MODEL_AUTHOR_STYLE', openaiDefault),
    genre_practices: str('LLM_MODEL_GENRE_PRACTICES', openaiDefault),
    channel_style: str('LLM_MODEL_CHANNEL_STYLE', str('LLM_MODEL_DEFAULT', 'gpt-4o')),
    transcript_analysis: str('LLM_MODEL_TRANSCRIPT_ANALYSIS', openaiDefault),
    advice: str('LLM_MODEL_ADVICE', str('LLM_MODEL_DEFAULT', 'gpt-4o')),
    planning: str('LLM_MODEL_PLANNING', research),
    research_queries: str('LLM_MODEL_RESEARCH_QUERIES', research),
    fact_extract: str('LLM_MODEL_FACT_EXTRACT', research),
    writer: writer,
    writer_refine: str('LLM_MODEL_WRITER_REFINE', writer),
    chapter_summary: writerSummary,
  };
  return defaults;
}

export type AppConfig = ReturnType<typeof appConfig>;

export const appConfig = () => ({
  port: int('PORT', 3000),
  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),
  promptsDir: str('PROMPTS_DIR', join(__dirname, '..', 'prompts')),
  llm: {
    mode: str('LLM_PROVIDER') === 'mock' ? ('mock' as const) : ('live' as const),
    providers: {
      openai: {
        apiKey: str('OPENAI_API_KEY'),
        baseUrl: str('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      },
      gemini: {
        apiKey: str('GEMINI_API_KEY'),
        baseUrl: str('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
      },
      xai: {
        apiKey: str('XAI_API_KEY'),
        baseUrl: str('XAI_BASE_URL', 'https://api.x.ai/v1'),
      },
      anthropic: {
        apiKey: str('ANTHROPIC_API_KEY'),
        baseUrl: str('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
        apiVersion: str('ANTHROPIC_VERSION', '2023-06-01'),
        maxTokens: int('ANTHROPIC_MAX_TOKENS', 8192),
        defaultModel: str('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929'),
        opusModel: str('ANTHROPIC_OPUS_MODEL', 'claude-opus-4-5-20251101'),
      },
      perplexity: {
        apiKey: str('PERPLEXITY_API_KEY'),
        baseUrl: str('PERPLEXITY_BASE_URL', 'https://api.perplexity.ai'),
        defaultModel: str('PERPLEXITY_MODEL', 'sonar-pro'),
      },
    },
    geminiDefaultModel: str('GEMINI_MODEL', 'gemini-2.0-flash'),
    xaiDefaultModel: str('XAI_MODEL', 'grok-2-latest'),
    models: defaultPipelineModels(),
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
