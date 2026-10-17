import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { LlmChatRequest, LlmChatResponse, LlmEmbedResponse, LlmMessage, LlmProvider } from '../llm.types';

function toOpenAi(m: LlmMessage): ChatCompletionMessageParam {
  switch (m.role) {
    case 'tool':
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    case 'assistant':
      return {
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.name, arguments: JSON.stringify(c.arguments) },
              })),
            }
          : {}),
      };
    default:
      return { role: m.role, content: m.content };
  }
}

function isResponseFormatRejected(e: unknown): boolean {
  if (!(e instanceof OpenAI.APIError) || e.status !== 400) return false;
  const msg = String(e.message ?? '').toLowerCase();
  return (
    msg.includes('response_format') ||
    msg.includes('json_schema') ||
    msg.includes('json_object') ||
    msg.includes('invalid schema') ||
    msg.includes('invalid request')
  );
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** OpenAI SDK client pointed at OpenAI, xAI, Gemini OpenAI-compat, Perplexity Sonar, etc. */
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  private readonly client: OpenAI;
  private readonly jsonMode: boolean;

  constructor(apiKey: string, baseURL: string, jsonMode = true) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.jsonMode = jsonMode;
  }

  async chat(req: LlmChatRequest): Promise<LlmChatResponse> {
    const hasTools = !!(req.tools?.length);
    const responseFormat = this.responseFormat(req, hasTools);
    try {
      return await this.create(req, responseFormat);
    } catch (e) {
      if (responseFormat && isResponseFormatRejected(e)) return this.create(req, undefined);
      throw e;
    }
  }

  private responseFormat(req: LlmChatRequest, hasTools: boolean) {
    if (hasTools) return undefined;
    if (req.structuredSchema) {
      return {
        type: 'json_schema' as const,
        json_schema: {
          name: req.structuredSchema.name,
          schema: req.structuredSchema.schema,
        },
      };
    }
    return this.jsonMode ? ({ type: 'json_object' as const } as const) : undefined;
  }

  private async create(
    req: LlmChatRequest,
    responseFormat: { type: 'json_schema'; json_schema: { name: string; schema: Record<string, unknown> } } | { type: 'json_object' } | undefined,
  ): Promise<LlmChatResponse> {
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages.map(toOpenAi),
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(req.tools?.length
        ? {
            tools: req.tools.map((t) => ({
              type: 'function' as const,
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
          }
        : {}),
    });
    const message = res.choices[0]?.message;
    return {
      content: message?.content ?? null,
      toolCalls: (message?.tool_calls ?? [])
        .filter((c) => c.type === 'function')
        .map((c) => ({ id: c.id, name: c.function.name, arguments: parseArgs(c.function.arguments) })),
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    };
  }

  async embed(model: string, texts: string[]): Promise<LlmEmbedResponse> {
    const res = await this.client.embeddings.create({ model, input: texts });
    return {
      vectors: [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding),
      inputTokens: res.usage?.prompt_tokens ?? 0,
    };
  }
}

/** @deprecated use OpenAiCompatibleLlmProvider */
export class OpenAiLlmProvider extends OpenAiCompatibleLlmProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.openai.com/v1');
  }
}
