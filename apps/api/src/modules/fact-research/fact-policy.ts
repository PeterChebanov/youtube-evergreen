import type { ExtractedFact, FactRelationKind } from '@youtube-ai-tool/shared';

export function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    for (const p of [...url.searchParams.keys()]) if (/^utm_/i.test(p)) url.searchParams.delete(p);
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return null;
  }
}

export type AcceptedFact = {
  text: string;
  sourceUrl: string;
  sourceTitle: string | null;
  relations: Array<{ toIndex: number; kind: FactRelationKind }>;
};

/**
 * Keeps only facts whose URL is one of the pages actually read (REQUIREMENTS
 * 4.2: no fact without a source), drops duplicates, and remaps relations to
 * the surviving facts.
 */
export function acceptFacts(
  facts: ExtractedFact[],
  sources: ReadonlyArray<{ url: string; title: string }>,
): AcceptedFact[] {
  const titles = new Map<string, string>();
  for (const s of sources) {
    const u = normalizeUrl(s.url);
    if (u) titles.set(u, s.title);
  }
  const newIndex = new Map<number, number>();
  const seen = new Set<string>();
  const kept: Array<AcceptedFact & { original: ExtractedFact }> = [];
  facts.forEach((f, i) => {
    const url = normalizeUrl(f.sourceUrl);
    const key = f.text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!url || !titles.has(url) || !key || seen.has(key)) return;
    seen.add(key);
    newIndex.set(i, kept.length);
    kept.push({ text: f.text.trim(), sourceUrl: url, sourceTitle: f.sourceTitle?.trim() || titles.get(url) || null, relations: [], original: f });
  });
  return kept.map(({ original, ...fact }, self) => ({
    ...fact,
    relations: original.relations.flatMap((r) => {
      const to = newIndex.get(r.toIndex);
      return to === undefined || to === self ? [] : [{ toIndex: to, kind: r.kind }];
    }),
  }));
}
