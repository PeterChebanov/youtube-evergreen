import { describe, expect, it } from 'vitest';
import type { SubtitleCheck } from '../../core/api.types';
import { channelLine, scenarioView, toneRows } from './subtitles.view';

const check = (over: Partial<SubtitleCheck>): SubtitleCheck =>
  ({
    scenario: 'match',
    youtubeVideoId: 'abc',
    youtubeTitle: 'Почему закрываются заводы',
    dbTitle: 'Почему закрываются заводы',
    youtubeChannelId: 'UC1',
    channelName: 'Утопия Шоу',
    channelInDb: true,
    channelStatus: 'ready',
    channelVideoCount: 236,
    durationSec: 3252,
    videoId: 'v1',
    transcriptStatus: 'none',
    transcriptAnalysis: null,
    ...over,
  }) as SubtitleCheck;

describe('scenarioView', () => {
  it('fetches right away when the video matches', () => {
    expect(scenarioView(check({})).primary).toEqual({ label: 'Fetch subtitles', confirm: 'none' });
  });

  it('asks before overwriting stored subtitles', () => {
    expect(scenarioView(check({ scenario: 'already_exists' })).primary.confirm).toBe('overwrite');
  });

  it('shows the stored title when YouTube shows a different one', () => {
    const view = scenarioView(check({ scenario: 'title_mismatch', dbTitle: 'Old title' }));
    expect(view.banner).toContain('“Old title”');
    expect(view.primary.confirm).toBe('title');
  });

  it('offers channel research for a partial channel, not for a researched one', () => {
    expect(scenarioView(check({ scenario: 'not_in_db_channel_exists', channelStatus: 'partial' })).offerChannelResearch).toBe(true);
    expect(scenarioView(check({ scenario: 'not_in_db_channel_exists', channelStatus: 'ready' })).offerChannelResearch).toBe(false);
  });

  it('asks before adding a video whose channel is unknown, and offers channel research', () => {
    const view = scenarioView(check({ scenario: 'not_in_db_channel_missing', channelInDb: false }));
    expect(view).toMatchObject({ offerChannelResearch: true, primary: { confirm: 'add' } });
  });
});

it('describes where the channel stands in the database', () => {
  expect(channelLine(check({ channelInDb: false }))).toBe('Утопия Шоу · not in database');
  expect(channelLine(check({ channelStatus: 'partial', channelVideoCount: 1 }))).toBe('Утопия Шоу · partial in database (1 video)');
});

it('lists only the tone fields the analysis has', () => {
  expect(toneRows({ pace: 'Fast', tone: '', phrases: ['And here is the catch'] })).toEqual([
    { label: 'Pace', value: 'Fast' },
    { label: 'Phrases', value: '', chips: ['And here is the catch'] },
  ]);
  expect(toneRows(null)).toEqual([]);
});
