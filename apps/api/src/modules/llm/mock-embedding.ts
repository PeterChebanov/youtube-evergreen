import { EMBEDDING_DIM } from './llm.types';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic bag-of-words embedding for offline mode: texts sharing words
 * point in similar directions, so similarity logic behaves realistically.
 */
export function mockEmbedding(text: string, dim = EMBEDDING_DIM): number[] {
  const v = new Array<number>(dim).fill(0);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  for (const w of words) {
    const h = hash(w);
    v[h % dim] += h & 1 ? 1 : -1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (!norm) {
    v[0] = 1;
    return v;
  }
  return v.map((x) => x / norm);
}
