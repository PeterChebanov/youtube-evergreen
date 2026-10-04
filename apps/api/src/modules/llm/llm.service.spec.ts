import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { appConfig, AppConfig } from '../../config/app.config';
import { DomainError } from '../../common/domain-error';
import type { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from './llm.service';
import type { LlmChatRequest, LlmChatResponse, LlmProvider } from './llm.types';

const schema = z.object({ answer: z.number() });

function setup(replies: Array<Partial<LlmChatResponse>>) {
  const requests: LlmChatRequest[] = [];
  const provider: LlmProvider = {
    chat: async (req) => {
      requests.push(structuredClone(req));
      const r = replies.shift() ?? { content: '{}' };
      return { content: null, toolCalls: [], inputTokens: 10, outputTokens: 5, ...r };
    },
    embed: async (_model, texts) => ({ vectors: texts.map(() => [1]), inputTokens: texts.length }),
  };
  const logged: Array<Record<string, unknown>> = [];
  const prisma = { llmCall: { create: async ({ data }: { data: Record<string, unknown> }) => logged.push(data) } };
  const config = new ConfigService(appConfig()) as unknown as ConfigService<AppConfig, true>;
  const service = new LlmService(provider, prisma as unknown as PrismaService, config);
  return { service, requests, logged };
}

const ask = (service: LlmService, tools?: Parameters<LlmService['completeStructured']>[0]['tools']) =>
  service.completeStructured({ promptName: 'planning', system: 'sys', user: { q: 1 }, schema, tools, projectId: 'p1' });

describe('LlmService.completeStructured', () => {
  it('returns validated data and logs the call against the project', async () => {
    const { service, logged } = setup([{ content: '```json\n{"answer": 42}\n```' }]);
    await expect(ask(service)).resolves.toEqual({ data: { answer: 42 }, dbToolsUsed: [] });
    expect(logged).toEqual([expect.objectContaining({ promptName: 'planning', projectId: 'p1', inputTokens: 10, succeeded: true })]);
  });

  it('feeds validation errors back to the model and accepts the corrected reply', async () => {
    const { service, requests, logged } = setup([{ content: '{"answer": "x"}' }, { content: '{"answer": 1}' }]);
    await expect(ask(service)).resolves.toMatchObject({ data: { answer: 1 } });
    const lastUserMessage = requests[1].messages.at(-1);
    expect(lastUserMessage).toMatchObject({ role: 'user', content: expect.stringContaining('answer') });
    expect(logged).toEqual([expect.objectContaining({ inputTokens: 20, outputTokens: 10 })]);
  });

  it('gives up after repeated invalid replies and still logs the spend', async () => {
    const { service, logged } = setup([{ content: 'nope' }, { content: 'nope' }, { content: 'nope' }]);
    await expect(ask(service)).rejects.toBeInstanceOf(DomainError);
    expect(logged).toEqual([expect.objectContaining({ inputTokens: 30, succeeded: false })]);
  });

  it('executes requested tools, returns their output to the model and records which were used', async () => {
    const { service, requests, logged } = setup([
      { toolCalls: [{ id: 't1', name: 'find_videos', arguments: { query: 'ussr' } }] },
      { content: '{"answer": 7}' },
    ]);
    const executed: unknown[] = [];
    const tools = {
      definitions: [{ name: 'find_videos', description: 'd', parameters: {} }],
      execute: async (call: { arguments: unknown }) => {
        executed.push(call.arguments);
        return [{ id: 'v1' }];
      },
    };
    await expect(ask(service, tools)).resolves.toEqual({ data: { answer: 7 }, dbToolsUsed: ['find_videos'] });
    expect(executed).toEqual([{ query: 'ussr' }]);
    expect(requests[1].messages.at(-1)).toEqual({ role: 'tool', toolCallId: 't1', content: '[{"id":"v1"}]' });
    expect(logged[0]).toMatchObject({ dbToolsUsed: ['find_videos'] });
  });

  it('reports tool failures to the model instead of aborting', async () => {
    const { service, requests } = setup([
      { toolCalls: [{ id: 't1', name: 'get_video', arguments: {} }] },
      { content: '{"answer": 0}' },
    ]);
    const tools = {
      definitions: [{ name: 'get_video', description: 'd', parameters: {} }],
      execute: async () => {
        throw new Error('video not found');
      },
    };
    await ask(service, tools);
    expect(requests[1].messages.at(-1)).toMatchObject({ content: '{"error":"video not found"}' });
  });
});
