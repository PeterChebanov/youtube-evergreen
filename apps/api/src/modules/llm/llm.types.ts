import type { LlmStageId } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import type { PromptName } from './prompt-names';

export const EMBEDDING_DIM = 1536;

export type LlmToolCall = { id: string; name: string; arguments: Record<string, unknown> };

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type LlmToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolSet = {
  definitions: LlmToolDefinition[];
  execute: (call: LlmToolCall) => Promise<unknown>;
};

export type LlmStructuredSchema = { name: string; schema: Record<string, unknown> };

export type LlmChatRequest = {
  model: string;
  promptName: PromptName;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  /** When set, OpenAI-compatible backends use `json_schema` instead of legacy `json_object`. */
  structuredSchema?: LlmStructuredSchema;
};

export type LlmChatResponse = {
  content: string | null;
  toolCalls: LlmToolCall[];
  inputTokens: number;
  outputTokens: number;
};

export type LlmEmbedResponse = { vectors: number[][]; inputTokens: number };

export interface LlmProvider {
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
  embed(model: string, texts: string[]): Promise<LlmEmbedResponse>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export type StructuredRequest<S extends z.ZodTypeAny> = {
  promptName: PromptName;
  system: string;
  user: string | object;
  schema: S;
  tools?: ToolSet;
  projectId?: string | null;
  /** Explicit stage for overrides (required for `research_queries` shallow vs fact). */
  stageId?: LlmStageId;
  /** One-off vendor id or `provider:model` for this call. */
  modelSelection?: string;
};

export type StructuredResult<T> = { data: T; dbToolsUsed: string[] };
