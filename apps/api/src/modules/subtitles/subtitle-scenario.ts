import type { SubtitleScenario, SubtitlesFetchRequest } from '@youtube-ai-tool/shared';

export type ScenarioInput = {
  dbVideo: { title: string; transcriptStatus: string } | null;
  youtubeTitle: string;
  channelInDb: boolean;
};

const normalizeTitle = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim();

/** REQUIREMENTS 6.1.1–6.1.4 and 6.2. */
export function resolveSubtitleScenario({ dbVideo, youtubeTitle, channelInDb }: ScenarioInput): SubtitleScenario {
  if (!dbVideo) return channelInDb ? 'not_in_db_channel_exists' : 'not_in_db_channel_missing';
  if (dbVideo.transcriptStatus === 'done') return 'already_exists';
  if (normalizeTitle(dbVideo.title) !== normalizeTitle(youtubeTitle)) return 'title_mismatch';
  return 'match';
}

type Confirmations = Pick<SubtitlesFetchRequest, 'confirmTitleMismatch' | 'confirmAddVideo' | 'confirmOverwrite'>;

/** Which explicit confirmation a scenario needs before anything is written; null when none. */
export function missingConfirmation(scenario: SubtitleScenario, c: Confirmations): keyof Confirmations | null {
  switch (scenario) {
    case 'match':
      return null;
    case 'title_mismatch':
      return c.confirmTitleMismatch ? null : 'confirmTitleMismatch';
    case 'already_exists':
      return c.confirmOverwrite ? null : 'confirmOverwrite';
    case 'not_in_db_channel_exists':
    case 'not_in_db_channel_missing':
      return c.confirmAddVideo ? null : 'confirmAddVideo';
  }
}
