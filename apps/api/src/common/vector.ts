export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function maxSimilarity(v: readonly number[], others: ReadonlyArray<readonly number[]>): number {
  return others.reduce((best, o) => Math.max(best, cosineSimilarity(v, o)), 0);
}

/** pgvector text literal, to be cast with `::vector` in raw SQL. */
export const toVectorLiteral = (v: readonly number[]) => `[${v.join(',')}]`;

export const parseVectorLiteral = (s: string): number[] =>
  s.replace(/^\[|\]$/g, '').split(',').filter(Boolean).map(Number);
