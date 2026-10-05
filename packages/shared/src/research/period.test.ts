import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseResearchPeriod, videoPublishedInPeriod } from './period';

describe('research period', () => {
  it('parses inclusive UTC day bounds', () => {
    const p = parseResearchPeriod({ publishedAfter: '2022-01-01', publishedBefore: '2022-01-31' });
    assert.equal(p.publishedAfter!.toISOString(), '2022-01-01T00:00:00.000Z');
    assert.equal(p.publishedBefore!.toISOString(), '2022-01-31T23:59:59.999Z');
  });

  it('filters by publishedAt', () => {
    const p = parseResearchPeriod({ publishedAfter: '2022-06-01', publishedBefore: '2023-06-01' });
    assert.equal(videoPublishedInPeriod(new Date('2022-07-01T12:00:00Z'), p), true);
    assert.equal(videoPublishedInPeriod(new Date('2020-01-01T12:00:00Z'), p), false);
    assert.equal(videoPublishedInPeriod(new Date('2024-01-01T12:00:00Z'), p), false);
  });
});
