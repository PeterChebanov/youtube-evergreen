import { cosineSimilarity, maxSimilarity, parseVectorLiteral, toVectorLiteral } from './vector';

describe('vectors', () => {
  it('measures direction, not length', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('treats empty or mismatched vectors as unrelated', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('finds the closest neighbour', () => {
    expect(maxSimilarity([1, 0], [[0, 1], [1, 0.1]])).toBeGreaterThan(0.99);
    expect(maxSimilarity([1, 0], [])).toBe(0);
  });

  it('round-trips the pgvector literal', () => {
    expect(parseVectorLiteral(toVectorLiteral([0.5, -1, 2]))).toEqual([0.5, -1, 2]);
  });
});
