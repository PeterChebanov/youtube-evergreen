export const LLM_PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'xai', 'perplexity'] as const;
export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

export function formatModelRef(provider: LlmProviderId, model: string): string {
  return `${provider}:${model}`;
}

/** `anthropic:claude-…` or legacy bare model id (treated as openai). */
export function parseModelRef(ref: string, legacyProvider: LlmProviderId = 'openai'): { provider: LlmProviderId; model: string } {
  const i = ref.indexOf(':');
  if (i > 0) {
    const head = ref.slice(0, i);
    if ((LLM_PROVIDER_IDS as readonly string[]).includes(head)) {
      return { provider: head as LlmProviderId, model: ref.slice(i + 1) };
    }
  }
  return { provider: legacyProvider, model: ref };
}

export function isModelRef(ref: string): boolean {
  const { provider, model } = parseModelRef(ref);
  return Boolean(model) && ref.includes(':') && (LLM_PROVIDER_IDS as readonly string[]).includes(provider);
}
