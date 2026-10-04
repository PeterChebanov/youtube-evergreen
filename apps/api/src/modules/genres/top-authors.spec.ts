import { rankTopAuthors } from './top-authors';

const medians = new Map([
  ['varlamov', 1_000_000],
  ['utopia', 200_000],
  ['tiny', 10_000],
]);

describe('rankTopAuthors', () => {
  it('ranks by success relative to each channel, not by raw views', () => {
    const top = rankTopAuthors(
      [
        { channelId: 'varlamov', channelName: 'Varlamov', views: 1_200_000 },
        { channelId: 'varlamov', channelName: 'Varlamov', views: 900_000 },
        { channelId: 'utopia', channelName: 'Utopia Show', views: 600_000 },
        { channelId: 'utopia', channelName: 'Utopia Show', views: 400_000 },
      ],
      medians,
    );
    expect(top.map((a) => [a.channelName, a.medianRelativeSuccess])).toEqual([
      ['Utopia Show', 2.5],
      ['Varlamov', 1.05],
    ]);
  });

  it('ignores authors with a single lucky video in the genre', () => {
    const top = rankTopAuthors(
      [
        { channelId: 'tiny', channelName: 'Tiny', views: 500_000 },
        { channelId: 'utopia', channelName: 'Utopia Show', views: 300_000 },
        { channelId: 'utopia', channelName: 'Utopia Show', views: 300_000 },
      ],
      medians,
    );
    expect(top.map((a) => a.channelId)).toEqual(['utopia']);
  });

  it('keeps at most the requested number of authors', () => {
    const videos = ['varlamov', 'utopia', 'tiny'].flatMap((id) => [
      { channelId: id, channelName: id, views: 100 },
      { channelId: id, channelName: id, views: 100 },
    ]);
    expect(rankTopAuthors(videos, medians, { limit: 2 })).toHaveLength(2);
  });
});
