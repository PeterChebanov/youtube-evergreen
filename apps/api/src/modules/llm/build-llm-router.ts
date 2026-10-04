import type { LlmProviderId } from '@youtube-ai-tool/shared';
import type { AppConfig } from '../../config/app.config';
import type { LlmProvider } from './llm.types';
import { AnthropicLlmProvider } from './providers/anthropic-llm.provider';
import { OpenAiCompatibleLlmProvider } from './providers/openai-compatible-llm.provider';
import { RoutingLlmProvider } from './providers/routing-llm.provider';

export function buildLlmRouter(cfg: AppConfig['llm']): LlmProvider {
  const backends = new Map<LlmProviderId, LlmProvider>();

  if (cfg.providers.openai.apiKey) {
    backends.set('openai', new OpenAiCompatibleLlmProvider(cfg.providers.openai.apiKey, cfg.providers.openai.baseUrl));
  }
  if (cfg.providers.gemini.apiKey) {
    backends.set('gemini', new OpenAiCompatibleLlmProvider(cfg.providers.gemini.apiKey, cfg.providers.gemini.baseUrl));
  }
  if (cfg.providers.xai.apiKey) {
    backends.set('xai', new OpenAiCompatibleLlmProvider(cfg.providers.xai.apiKey, cfg.providers.xai.baseUrl));
  }
  if (cfg.providers.perplexity.apiKey) {
    backends.set(
      'perplexity',
      new OpenAiCompatibleLlmProvider(cfg.providers.perplexity.apiKey, cfg.providers.perplexity.baseUrl),
    );
  }
  if (cfg.providers.anthropic.apiKey) {
    backends.set(
      'anthropic',
      new AnthropicLlmProvider(
        cfg.providers.anthropic.apiKey,
        cfg.providers.anthropic.baseUrl,
        cfg.providers.anthropic.apiVersion,
        cfg.providers.anthropic.maxTokens,
      ),
    );
  }

  if (!backends.size) {
    throw new Error('No LLM API keys configured. Set OPENAI_API_KEY or other provider keys, or LLM_PROVIDER=mock.');
  }

  const embed = backends.get('openai') ?? backends.values().next().value!;
  return new RoutingLlmProvider(backends, embed);
}
