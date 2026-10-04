// Keeps the layout fixtures honest: each one must satisfy the API contract from @youtube-ai-tool/shared.
import { describe, expect, it } from 'vitest';
import * as shared from '@youtube-ai-tool/shared';
import { respond } from './layout-fixtures.mjs';

const get = (path, method = 'GET') => respond(method, path, new URLSearchParams())[1];

describe('layout fixtures follow the API contract', () => {
  it.each([
    ['/ops/status', shared.opsStatusSchema],
    ['/projects', shared.projectSchema.array()],
    ['/library/channels', shared.channelSummarySchema.array()],
    ['/library/channels/c1', shared.channelDetailSchema],
    ['/projects/p1/facts', shared.factResearchStateSchema],
    ['/projects/p1/script', shared.writerStateSchema],
    ['/my-videos/memory', shared.topicMemorySchema],
  ])('%s', (path, schema) => {
    expect(() => schema.parse(get(path))).not.toThrow();
  });

  it('POST /advice', () => expect(() => shared.adviceRunResultSchema.parse(get('/advice', 'POST'))).not.toThrow());
  it('POST /subtitles/check', () => expect(() => shared.subtitleCheckSchema.parse(get('/subtitles/check', 'POST'))).not.toThrow());
  it('plan versions', () => {
    for (const v of get('/projects/p1/plan')) expect(() => shared.planContentSchema.parse(v.content)).not.toThrow();
  });
});
