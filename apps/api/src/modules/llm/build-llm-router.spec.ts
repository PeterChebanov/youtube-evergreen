import { parseModelRef } from '@youtube-ai-tool/shared';
import { appConfig } from '../../config/app.config';
import { buildLlmRouter } from './build-llm-router';
import { RoutingLlmProvider } from './providers/routing-llm.provider';

describe('buildLlmRouter', () => {
  const prev = process.env;

  beforeEach(() => {
    process.env = { ...prev, LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = prev;
  });

  it('builds a routing provider when at least one key is set', () => {
    const router = buildLlmRouter(appConfig().llm);
    expect(router).toBeInstanceOf(RoutingLlmProvider);
  });

  it('parseModelRef splits provider prefix', () => {
    expect(parseModelRef('anthropic:claude-sonnet-4-5-20250929')).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
    });
    expect(parseModelRef('gpt-4o')).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });
});
