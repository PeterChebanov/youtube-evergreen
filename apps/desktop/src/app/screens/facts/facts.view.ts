import type { FactDto } from '../../core/api.types';

const RELATION_LABEL: Record<string, string> = {
  supports: 'supports',
  explains: 'explains',
  contrasts: 'contrasts',
  same_pattern: 'same pattern as',
  anecdote: 'anecdote for',
};

export type FactRow = { fact: FactDto; n: number; relations: string[] };

/** Facts of one chapter, numbered, with connections named by the number of the related fact. */
export function chapterFacts(facts: FactDto[], chapterOrder: number): FactRow[] {
  const list = facts.filter((f) => f.planChapterOrder === chapterOrder && !!f.sourceUrl);
  const number = new Map(list.map((f, i) => [f.id, i + 1]));
  return list.map((fact, i) => ({
    fact,
    n: i + 1,
    relations: fact.relations
      .filter((r) => number.has(r.factId))
      .map((r) => `${RELATION_LABEL[r.kind] ?? r.kind} ${number.get(r.factId)}`),
  }));
}

export function sourcesMeta(rows: FactRow[]): string {
  const hosts = new Set(rows.map((r) => hostOf(r.fact.sourceUrl)));
  return `${rows.length} facts · ${hosts.size} ${hosts.size === 1 ? 'source' : 'sources'}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const isHttpUrl = (value: string) => /^https?:\/\/\S+\.\S+/i.test(value.trim());
