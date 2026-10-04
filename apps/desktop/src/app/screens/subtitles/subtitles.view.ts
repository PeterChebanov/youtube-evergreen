import type { SubtitleCheck } from '../../core/api.types';
import { plural } from '../../core/format';

export type ScenarioView = {
  pill: { text: string; cls: '' | 'pill-ok' | 'pill-warn' | 'pill-acc' };
  banner: string | null;
  primary: { label: string; confirm: 'none' | 'title' | 'add' | 'overwrite' };
  offerChannelResearch: boolean;
};

/** What the author sees for each subtitle scenario (REQUIREMENTS 6.1.x). */
export function scenarioView(c: SubtitleCheck): ScenarioView {
  switch (c.scenario) {
    case 'match':
      return { pill: { text: 'Found', cls: 'pill-ok' }, banner: null, primary: { label: 'Fetch subtitles', confirm: 'none' }, offerChannelResearch: false };
    case 'already_exists':
      return {
        pill: { text: 'Subtitles stored', cls: 'pill-ok' },
        banner: 'Subtitles for this video are already stored. Fetching again overwrites them.',
        primary: { label: 'Overwrite subtitles', confirm: 'overwrite' },
        offerChannelResearch: false,
      };
    case 'title_mismatch':
      return {
        pill: { text: 'Title differs', cls: 'pill-acc' },
        banner: `The title on YouTube differs from the stored one: “${c.dbTitle ?? ''}”. Check that this is the same video.`,
        primary: { label: 'Fetch anyway', confirm: 'title' },
        offerChannelResearch: false,
      };
    case 'not_in_db_channel_exists':
      return {
        pill: { text: 'Not found', cls: 'pill-warn' },
        banner: 'This video is not in the database yet. Add this video, or research the whole channel first.',
        primary: { label: 'Add video and analyze', confirm: 'add' },
        offerChannelResearch: c.channelStatus === 'partial',
      };
    case 'not_in_db_channel_missing':
      return {
        pill: { text: 'Not found', cls: 'pill-warn' },
        banner: 'Neither this video nor its channel is in the database. Add the video (its channel is saved as partial), or research the whole channel.',
        primary: { label: 'Add video and analyze', confirm: 'add' },
        offerChannelResearch: true,
      };
  }
}

export function channelLine(c: SubtitleCheck): string {
  if (!c.channelInDb) return `${c.channelName} · not in database`;
  const count = plural(c.channelVideoCount ?? 0, 'video');
  return c.channelStatus === 'partial' ? `${c.channelName} · partial in database (${count})` : `${c.channelName} · in database (${count})`;
}

export type ToneRow = { label: string; value: string; chips?: string[] };

export function toneRows(analysis: Record<string, unknown> | null): ToneRow[] {
  if (!analysis) return [];
  const text = (k: string) => (typeof analysis[k] === 'string' ? (analysis[k] as string) : '');
  const list = (k: string) => (Array.isArray(analysis[k]) ? (analysis[k] as unknown[]).map(String) : []);
  return [
    { label: 'Pace', value: text('pace') },
    { label: 'Address', value: text('address') },
    { label: 'Humor', value: text('humor') },
    { label: 'Tone', value: text('tone') },
    { label: 'Phrases', value: '', chips: list('phrases') },
  ].filter((r) => r.value || r.chips?.length);
}
