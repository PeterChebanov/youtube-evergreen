import type { LlmChatRequest, LlmChatResponse, LlmEmbedResponse, LlmProvider } from '../llm.types';
import { mockEmbedding } from '../mock-embedding';
import { MOCK_RESPONSES } from './mock-responses';

const tokens = (s: string) => Math.ceil(s.length / 4);

export class MockLlmProvider implements LlmProvider {
  async chat(req: LlmChatRequest): Promise<LlmChatResponse> {
    const prompt = req.messages.map((m) => m.content ?? '').join('\n');
    const usedTool = req.messages.some((m) => m.role === 'tool');
    if (req.tools?.length && !usedTool) {
      return {
        content: null,
        toolCalls: [{ id: 'mock-tool-1', name: req.tools[0].name, arguments: {} }],
        inputTokens: tokens(prompt),
        outputTokens: 10,
      };
    }
    const user = req.messages.find((m) => m.role === 'user')?.content ?? '{}';
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(user);
    } catch {
      input = { text: user };
    }
    const content = JSON.stringify(MOCK_RESPONSES[req.promptName](input));
    return { content, toolCalls: [], inputTokens: tokens(prompt), outputTokens: tokens(content) };
  }

  async embed(_model: string, texts: string[]): Promise<LlmEmbedResponse> {
    return { vectors: texts.map((t) => mockEmbedding(t)), inputTokens: texts.reduce((s, t) => s + tokens(t), 0) };
  }
}
