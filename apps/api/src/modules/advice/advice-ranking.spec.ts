import { CandidateInput, rankCandidates, RankingContext } from './candidates';
import { median, relativeSuccess, snapshotVelocity } from './metrics';

const NOW = new Date('2026-10-04T00:00:00Z');
const OLD = new Date('2022-01-01T00:00:00Z');

const candidate = (videoId: string, over: Partial<CandidateInput> = {}): CandidateInput => ({
  videoId,
  channelId: 'small',
  views: 100_000,
  publishedAt: OLD,
  snapshots: [],
  embedding: null,
  ...over,
});

const ctx = (over: Partial<RankingContext> = {}): RankingContext => ({
  now: NOW,
  channelMedians: new Map([
    ['small', 20_000],
    ['big', 2_000_000],
  ]),
  myVideoEmbeddings: [],
  recentLibraryEmbeddings: [],
  limit: 10,
  ...over,
});

describe('Advice candidate ranking', () => {
  it("prefers a small channel's breakout over a big channel's average video", () => {
    const ranked = rankCandidates(
      [candidate('big-average', { channelId: 'big', views: 2_000_000 }), candidate('small-hit', { views: 200_000 })],
      ctx(),
    );
    expect(ranked.map((r) => r.videoId)).toEqual(['small-hit', 'big-average']);
    expect(ranked[0].relativeSuccess).toBe(10);
  });

  it('never proposes a topic we have already made', () => {
    const ranked = rankCandidates(
      [candidate('repeat', { embedding: [1, 0] }), candidate('fresh', { embedding: [0, 1] })],
      ctx({ myVideoEmbeddings: [[1, 0.05]] }),
    );
    expect(ranked.map((r) => r.videoId)).toEqual(['fresh']);
  });

  it('pushes down topics the niche covered recently', () => {
    const ranked = rankCandidates(
      [candidate('covered', { embedding: [1, 0], views: 150_000 }), candidate('untouched', { embedding: [0, 1], views: 100_000 })],
      ctx({ recentLibraryEmbeddings: [[1, 0]] }),
    );
    expect(ranked[0].videoId).toBe('untouched');
  });

  it('leans towards the requested theme', () => {
    const ranked = rankCandidates(
      [candidate('off-theme', { embedding: [0, 1], views: 120_000 }), candidate('on-theme', { embedding: [1, 0] })],
      ctx({ themeEmbedding: [1, 0] }),
    );
    expect(ranked[0].videoId).toBe('on-theme');
  });

  it('uses snapshot velocity when the video was researched more than once', () => {
    const [r] = rankCandidates(
      [
        candidate('a', {
          snapshots: [
            { researchedAt: new Date('2026-09-01'), views: 90_000 },
            { researchedAt: new Date('2026-09-11'), views: 100_000 },
          ],
        }),
      ],
      ctx(),
    );
    expect(r.velocityPerDay).toBe(1000);
  });

  it('returns at most the requested number of candidates', () => {
    const many = Array.from({ length: 30 }, (_, i) => candidate(`v${i}`, { views: 10_000 + i }));
    expect(rankCandidates(many, ctx({ limit: 8 }))).toHaveLength(8);
  });
});

describe('metrics', () => {
  it('computes the median of odd and even samples', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('needs two snapshots at least a day apart for velocity', () => {
    expect(snapshotVelocity([{ researchedAt: NOW, views: 1 }])).toBeNull();
    expect(snapshotVelocity([
      { researchedAt: NOW, views: 1 },
      { researchedAt: new Date(NOW.getTime() + 3600_000), views: 100 },
    ])).toBeNull();
  });

  it('scores nothing for a channel without a median', () => {
    expect(relativeSuccess(1000, 0)).toBe(0);
  });
});
