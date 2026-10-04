import { parseModelRef, type LlmProviderId } from '@youtube-ai-tool/shared';
import type { LlmChatRequest, LlmChatResponse, LlmEmbedResponse, LlmProvider } from '../llm.types';

export class RoutingLlmProvider implements LlmProvider {
  constructor(
    private readonly backends: Map<LlmProviderId, LlmProvider>,
    private readonly embedBackend: LlmProvider,
  ) {}

  async chat(req: LlmChatRequest): Promise<LlmChatResponse> {
    const { provider, model } = parseModelRef(req.model);
    const backend = this.backends.get(provider);
    if (!backend) {
      throw new Error(`LLM provider "${provider}" is not configured (model ref: ${req.model})`);
    }
    return backend.chat({ ...req, model });
  }

  async embed(model: string, texts: string[]): Promise<LlmEmbedResponse> {
    const { provider, model: id } = parseModelRef(model);
    const backend = provider === 'openai' ? this.backends.get('openai') : this.embedBackend;
    if (!backend) throw new Error('No embedding provider configured (set OPENAI_API_KEY)');
    return backend.embed(id, texts);
  }
}
