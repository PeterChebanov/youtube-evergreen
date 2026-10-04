import { acceptFacts, normalizeUrl } from './fact-policy';

const sources = [
  { url: 'https://history.example/pripyat/', title: 'Pripyat history' },
  { url: 'https://www.reddit.com/r/history/comments/abc', title: 'I lived there' },
];

const fact = (text: string, sourceUrl: string, relations: Array<{ toIndex: number; kind: 'supports' | 'anecdote' }> = []) => ({
  text,
  sourceUrl,
  relations,
});

describe('acceptFacts', () => {
  it('keeps facts sourced from pages that were actually read', () => {
    const [f] = acceptFacts([fact('The city was evacuated in 1986.', 'https://history.example/pripyat#top')], sources);
    expect(f).toEqual({
      text: 'The city was evacuated in 1986.',
      sourceUrl: 'https://history.example/pripyat',
      sourceTitle: 'Pripyat history',
      relations: [],
    });
  });

  it('drops facts without a URL or with a URL the model invented', () => {
    const kept = acceptFacts(
      [fact('no source', ''), fact('made up', 'https://invented.example/page'), fact('not a link', 'see Wikipedia')],
      sources,
    );
    expect(kept).toEqual([]);
  });

  it('drops repeated facts', () => {
    const kept = acceptFacts(
      [fact('Same  fact.', sources[0].url), fact('same fact.', sources[1].url)],
      sources,
    );
    expect(kept).toHaveLength(1);
  });

  it('remaps relations onto the surviving facts and drops broken ones', () => {
    const kept = acceptFacts(
      [
        fact('A', sources[0].url),
        fact('dropped', 'https://invented.example'),
        fact('B', sources[1].url, [{ toIndex: 0, kind: 'anecdote' }, { toIndex: 1, kind: 'supports' }, { toIndex: 2, kind: 'supports' }]),
      ],
      sources,
    );
    expect(kept.map((f) => [f.text, f.relations])).toEqual([
      ['A', []],
      ['B', [{ toIndex: 0, kind: 'anecdote' }]],
    ]);
  });
});

describe('normalizeUrl', () => {
  it('removes fragments, tracking parameters and trailing slashes', () => {
    expect(normalizeUrl('https://a.example/x/?utm_source=t&id=1#frag')).toBe('https://a.example/x?id=1');
    expect(normalizeUrl('https://a.example/')).toBe('https://a.example/');
  });

  it('rejects non-web links', () => {
    expect(normalizeUrl('ftp://a.example/file')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});
