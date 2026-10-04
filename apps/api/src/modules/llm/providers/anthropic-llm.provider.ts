import type { LlmChatRequest, LlmChatResponse, LlmEmbedResponse, LlmMessage, LlmProvider, LlmToolCall } from '../llm.types';

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type AnthropicMessage = { role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] };

function splitSystem(messages: LlmMessage[]): { system: string; rest: LlmMessage[] } {
  const systemParts: string[] = [];
  const rest: LlmMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else rest.push(m);
  }
  return { system: systemParts.join('\n\n'), rest };
}

function toAnthropic(messages: LlmMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i]!;
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
      i++;
      continue;
    }
    if (m.role === 'assistant') {
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) {
        blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.arguments });
      }
      out.push({ role: 'assistant', content: blocks.length ? blocks : '' });
      i++;
      continue;
    }
    if (m.role === 'tool') {
      const toolResults: AnthropicContentBlock[] = [];
      while (i < messages.length && messages[i]!.role === 'tool') {
        const t = messages[i] as Extract<LlmMessage, { role: 'tool' }>;
        toolResults.push({ type: 'tool_result', tool_use_id: t.toolCallId, content: t.content });
        i++;
      }
      out.push({ role: 'user', content: toolResults });
      continue;
    }
    i++;
  }
  return out;
}

export class AnthropicLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly apiVersion: string,
    private readonly maxTokens: number,
  ) {}

  async chat(req: LlmChatRequest): Promise<LlmChatResponse> {
    const { system, rest } = splitSystem(req.messages);
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: this.maxTokens,
      system: system || undefined,
      messages: toAnthropic(rest),
    };
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`Anthropic chat failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      content?: AnthropicContentBlock[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    let text = '';
    const toolCalls: LlmToolCall[] = [];
    for (const block of data.content ?? []) {
      if (block.type === 'text') text += block.text;
      if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
    }
    return {
      content: text || null,
      toolCalls,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }

  async embed(_model: string, _texts: string[]): Promise<LlmEmbedResponse> {
    throw new Error('Anthropic does not provide embeddings; configure OPENAI_API_KEY for LLM_EMBEDDING_MODEL');
  }
}
