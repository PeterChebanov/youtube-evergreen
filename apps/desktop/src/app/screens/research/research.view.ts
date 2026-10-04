import type { ChannelSummary } from '../../core/api.types';
import { daysAgo, plural, whenLabel } from '../../core/format';

export type ChannelRow = {
  state: string;
  pill: '' | 'pill-ok' | 'pill-acc' | 'pill-warn' | 'pill-bad';
  bar: '' | 'progress-ok' | 'progress-warn';
  percent: number;
  sub: string;
  retryJobId: string | null;
  active: boolean;
};

/** How one channel reads in the Channels table (DESIGN_SPEC 6.1 states). */
export function channelRow(c: ChannelSummary, now: Date): ChannelRow {
  const job = c.job;
  const base = { percent: Math.round(job?.progress ?? 0), retryJobId: null, active: false };
  if (job?.status === 'paused_quota') {
    const until = job.pausedUntil ? `Resumes ${whenLabel(job.pausedUntil, now)}` : 'Resumes after the quota reset';
    return { ...base, state: 'Paused', pill: 'pill-warn', bar: 'progress-warn', sub: `YouTube quota reached. ${until}`, active: true };
  }
  if (job?.status === 'failed') {
    return { ...base, state: 'Failed', pill: 'pill-bad', bar: '', sub: job.error ?? c.analysisError ?? 'Research failed', retryJobId: job.id };
  }
  if (job?.status === 'queued') {
    return { ...base, state: 'Queued', pill: '', bar: '', sub: 'Waiting for the research queue', active: true };
  }
  if (job?.status === 'running') {
    if (job.stage === 'collect') {
      return { ...base, state: 'Collecting', pill: 'pill-acc', bar: '', sub: `Collecting video list · ${plural(c.videoCount, 'long-form video')} so far`, active: true };
    }
    const sub = job.stage === 'author' ? 'Writing the author style' : `${c.analyzedCount.toLocaleString('en-US')} of ${plural(c.videoCount, 'video')} analyzed`;
    return { ...base, state: 'Analyzing', pill: 'pill-acc', bar: '', sub, active: true };
  }
  if (c.researchStatus === 'partial') {
    return { ...base, state: 'Partial', pill: '', bar: '', percent: 0, sub: `${plural(c.videoCount, 'video')} added from Subtitles · not researched` };
  }
  if (c.researchStatus === 'analysis_failed') {
    return { ...base, state: 'Failed', pill: 'pill-bad', bar: '', sub: c.analysisError ?? 'Analysis failed' };
  }
  const synced = c.lastResearchedAt ? ` · synced ${daysAgo(c.lastResearchedAt, now)}` : '';
  return { ...base, state: 'Ready', pill: 'pill-ok', bar: 'progress-ok', percent: 100, sub: `${c.videoCount.toLocaleString('en-US')} long-form${synced}` };
}

export type LogLine = { state: 'done' | 'run' | 'queued' | 'paused' | 'fail'; cls: '' | 'is-run' | 'is-queued' | 'is-fail'; text: string };

const STAGES = ['collect', 'analyze', 'author'] as const;

/** The BullMQ job of the selected channel, one line per pipeline stage. */
export function jobLog(c: ChannelSummary): LogLine[] {
  const job = c.job;
  if (!job) return [];
  const texts = [
    `Fetch video list · ${c.videoCount.toLocaleString('en-US')} found`,
    `AI analysis · ${c.analyzedCount.toLocaleString('en-US')} / ${c.videoCount.toLocaleString('en-US')}`,
    'Author style',
  ];
  const current = job.status === 'done' ? STAGES.length : Math.max(0, STAGES.indexOf(job.stage as (typeof STAGES)[number]));
  return STAGES.map((_, i): LogLine => {
    if (i < current) return { state: 'done', cls: '', text: texts[i] };
    if (i > current) return { state: 'queued', cls: 'is-queued', text: texts[i] };
    if (job.status === 'failed') return { state: 'fail', cls: 'is-fail', text: texts[i] };
    if (job.status === 'paused_quota') return { state: 'paused', cls: 'is-queued', text: texts[i] };
    if (job.status === 'queued') return { state: 'queued', cls: 'is-queued', text: texts[i] };
    return { state: 'run', cls: 'is-run', text: texts[i] };
  });
}

export function channelsMeta(channels: ChannelSummary[], now: Date): string {
  const rows = channels.map((c) => channelRow(c, now));
  const running = rows.filter((r) => r.state === 'Collecting' || r.state === 'Analyzing').length;
  const paused = rows.filter((r) => r.state === 'Paused').length;
  const parts = [plural(channels.length, 'channel'), `${running} running`];
  if (paused) parts.push(`${paused} paused`);
  return parts.join(' · ');
}
