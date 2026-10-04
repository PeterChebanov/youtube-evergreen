import { describe, expect, it } from 'vitest';
import type { ChannelSummary } from '../../core/api.types';
import { channelRow, channelsMeta, jobLog } from './research.view';

const now = new Date(2026, 9, 4, 12);
type Job = NonNullable<ChannelSummary['job']>;

const channel = (over: Partial<ChannelSummary> = {}, job: Partial<Job> | null = null): ChannelSummary =>
  ({
    id: 'c1',
    youtubeChannelId: 'UC1',
    channelName: 'Утопия Шоу',
    youtubeUrl: 'https://www.youtube.com/channel/UC1',
    researchStatus: 'ready',
    analysisError: null,
    lastResearchedAt: null,
    videoCount: 638,
    analyzedCount: 396,
    job: job ? { id: 'j1', status: 'running', stage: 'analyze', progress: 62, error: null, pausedUntil: null, ...job } : null,
    ...over,
  }) as ChannelSummary;

describe('channelRow', () => {
  it('shows a quota pause with the resume time and keeps the job active', () => {
    const row = channelRow(channel({}, { status: 'paused_quota', pausedUntil: new Date(2026, 9, 5, 9).toISOString() }), now);
    expect(row).toMatchObject({ state: 'Paused', pill: 'pill-warn', active: true });
    expect(row.sub).toBe('YouTube quota reached. Resumes tomorrow 09:00');
  });

  it('offers a retry for a failed job with its error', () => {
    const row = channelRow(channel({}, { status: 'failed', error: 'LLM timed out' }), now);
    expect(row).toMatchObject({ state: 'Failed', retryJobId: 'j1', sub: 'LLM timed out', active: false });
  });

  it('reports analysis progress while running', () => {
    expect(channelRow(channel({}, {}), now)).toMatchObject({ state: 'Analyzing', percent: 62, sub: '396 of 638 videos analyzed' });
  });

  it('marks channels added from Subtitles as partial, not researched', () => {
    expect(channelRow(channel({ researchStatus: 'partial', videoCount: 1 }), now)).toMatchObject({ state: 'Partial', percent: 0 });
  });

  it('shows a finished channel as ready with the sync age', () => {
    const row = channelRow(channel({ videoCount: 417, lastResearchedAt: new Date(2026, 9, 2).toISOString() }), now);
    expect(row).toMatchObject({ state: 'Ready', percent: 100, sub: '417 long-form · synced 2 days ago' });
  });
});

describe('jobLog', () => {
  it('marks earlier stages done, the current one running and later ones queued', () => {
    expect(jobLog(channel({}, {})).map((l) => l.state)).toEqual(['done', 'run', 'queued']);
  });

  it('marks the stage that failed', () => {
    expect(jobLog(channel({}, { status: 'failed', stage: 'collect' })).map((l) => l.state)).toEqual(['fail', 'queued', 'queued']);
  });

  it('has no lines without a job', () => {
    expect(jobLog(channel())).toEqual([]);
  });
});

it('summarizes running and paused channels', () => {
  const list = [channel({}, {}), channel({}, { status: 'paused_quota' }), channel()];
  expect(channelsMeta(list, now)).toBe('3 channels · 1 running · 1 paused');
});
