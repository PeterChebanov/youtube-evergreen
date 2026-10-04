import { describe, expect, it } from 'vitest';
import type { FactDto } from '../../core/api.types';
import { chapterFacts, isHttpUrl, sourcesMeta } from './facts.view';

const fact = (id: string, order: number, sourceUrl: string, relations: FactDto['relations'] = []): FactDto =>
  ({ id, planChapterOrder: order, iteration: 1, text: `Fact ${id}`, sourceUrl, sourceTitle: null, relations }) as FactDto;

const facts = [
  fact('a', 1, 'https://www.example.org/a', [{ factId: 'b', kind: 'supports' }, { factId: 'x', kind: 'explains' }]),
  fact('b', 1, 'https://example.org/b', [{ factId: 'a', kind: 'same_pattern' }]),
  fact('c', 1, 'https://reddit.com/r/x'),
  fact('x', 2, 'https://example.org/x'),
];

describe('chapterFacts', () => {
  it('numbers the facts of one chapter and names connections by number', () => {
    expect(chapterFacts(facts, 1).map((r) => [r.n, r.relations])).toEqual([
      [1, ['supports 2']],
      [2, ['same pattern as 1']],
      [3, []],
    ]);
  });

  it('hides facts without a source URL', () => {
    expect(chapterFacts([fact('a', 1, '')], 1)).toEqual([]);
  });
});

it('counts distinct source hosts', () => {
  expect(sourcesMeta(chapterFacts(facts, 1))).toBe('3 facts · 2 sources');
});

it('accepts only http(s) URLs for manual facts', () => {
  expect(isHttpUrl(' https://example.org/a ')).toBe(true);
  expect(isHttpUrl('example.org')).toBe(false);
  expect(isHttpUrl('ftp://example.org')).toBe(false);
});
