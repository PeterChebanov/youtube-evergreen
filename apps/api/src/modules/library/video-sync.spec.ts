import type { YoutubeVideo } from '../youtube/youtube.gateway';
import { planVideoSync, UNAVAILABLE } from './video-sync';

const video = (id: string, over: Partial<YoutubeVideo> = {}): YoutubeVideo => ({
  youtubeVideoId: id,
  youtubeChannelId: 'UC1',
  channelTitle: 'Channel',
  title: `Video ${id}`,
  description: 'Plain description',
  publishedAt: new Date('2020-01-01'),
  views: 1000,
  durationSec: 3000,
  ...over,
});

describe('planVideoSync', () => {
  it('stores new long-form videos and drops Shorts', () => {
    const plan = planVideoSync([video('a'), video('b', { durationSec: 40 })], new Map(), 60);
    expect(plan.create.map((v) => v.youtubeVideoId)).toEqual(['a']);
    expect(plan.skippedShorts).toBe(1);
  });

  it('only snapshots views of videos already in the library', () => {
    const plan = planVideoSync([video('a', { views: 5000 })], new Map([['a', 'db-a']]), 60);
    expect(plan.create).toEqual([]);
    expect(plan.snapshot).toEqual([{ videoId: 'db-a', views: 5000 }]);
  });

  it('marks missing descriptions and chapters as unavailable', () => {
    const [v] = planVideoSync([video('a', { description: '  ' })], new Map(), 60).create;
    expect(v.description).toBe(UNAVAILABLE);
    expect(v.chaptersStatus).toBe('unavailable');
    expect(v.chapters).toEqual([]);
  });

  it('takes chapters from the description when the author listed them', () => {
    const [v] = planVideoSync(
      [video('a', { description: 'Intro\n0:00 Start\n10:00 Middle\n40:00 End', durationSec: 3000 })],
      new Map(),
      60,
    ).create;
    expect(v.chaptersStatus).toBe('available');
    expect(v.chapters.map((c) => [c.title, c.startTimestamp, c.endTimestamp])).toEqual([
      ['Start', '0:00', '10:00'],
      ['Middle', '10:00', '40:00'],
      ['End', '40:00', '50:00'],
    ]);
    expect(v.url).toBe('https://www.youtube.com/watch?v=a');
  });

  it('ignores the same video appearing twice in one page', () => {
    expect(planVideoSync([video('a'), video('a')], new Map(), 60).create).toHaveLength(1);
  });
});
