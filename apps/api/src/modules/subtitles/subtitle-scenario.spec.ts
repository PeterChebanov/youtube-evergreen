import { missingConfirmation, resolveSubtitleScenario } from './subtitle-scenario';

const stored = (title: string, transcriptStatus = 'empty') => ({ title, transcriptStatus });
const none = { confirmTitleMismatch: false, confirmAddVideo: false, confirmOverwrite: false };

describe('resolveSubtitleScenario', () => {
  it('matches a stored video whose title is unchanged, ignoring whitespace', () => {
    expect(resolveSubtitleScenario({ dbVideo: stored('Fall of  the USSR '), youtubeTitle: 'Fall of the USSR', channelInDb: true })).toBe('match');
  });

  it('flags a renamed video', () => {
    expect(resolveSubtitleScenario({ dbVideo: stored('Old title'), youtubeTitle: 'New title', channelInDb: true })).toBe('title_mismatch');
  });

  it('reports subtitles already stored before anything else', () => {
    expect(resolveSubtitleScenario({ dbVideo: stored('Old', 'done'), youtubeTitle: 'New', channelInDb: true })).toBe('already_exists');
  });

  it('distinguishes an unknown video of a known channel from a wholly unknown one', () => {
    expect(resolveSubtitleScenario({ dbVideo: null, youtubeTitle: 'x', channelInDb: true })).toBe('not_in_db_channel_exists');
    expect(resolveSubtitleScenario({ dbVideo: null, youtubeTitle: 'x', channelInDb: false })).toBe('not_in_db_channel_missing');
  });

  it('retries a download that previously failed or found nothing', () => {
    expect(resolveSubtitleScenario({ dbVideo: stored('T', 'unavailable'), youtubeTitle: 'T', channelInDb: true })).toBe('match');
  });
});

describe('missingConfirmation', () => {
  it('downloads straight away only on a clean match', () => {
    expect(missingConfirmation('match', none)).toBeNull();
    expect(missingConfirmation('title_mismatch', none)).toBe('confirmTitleMismatch');
    expect(missingConfirmation('already_exists', none)).toBe('confirmOverwrite');
    expect(missingConfirmation('not_in_db_channel_exists', none)).toBe('confirmAddVideo');
    expect(missingConfirmation('not_in_db_channel_missing', none)).toBe('confirmAddVideo');
  });

  it('accepts the confirmation that matches the scenario and no other', () => {
    expect(missingConfirmation('title_mismatch', { ...none, confirmTitleMismatch: true })).toBeNull();
    expect(missingConfirmation('already_exists', { ...none, confirmAddVideo: true })).toBe('confirmOverwrite');
  });
});
