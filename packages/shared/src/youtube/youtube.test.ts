import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseChaptersFromDescription } from './chapter-parser';
import { formatDuration, parseIsoDuration } from './duration';
import { extractYoutubeVideoId, parseChannelRef } from './url';

describe('parseChaptersFromDescription', () => {
  it('reads a YouTube chapter list and closes each chapter at the next start', () => {
    const chapters = parseChaptersFromDescription(
      'Intro text\n0:00 Cold open\n3:30 The promise\n1:02:05 The answer\nlinks below',
      4000,
    );
    assert.deepEqual(
      chapters.map((c) => [c.order, c.title, c.startTimestamp, c.endTimestamp]),
      [
        [1, 'Cold open', '0:00', '3:30'],
        [2, 'The promise', '3:30', '1:02:05'],
        [3, 'The answer', '1:02:05', '1:06:40'],
      ],
    );
  });

  it('accepts bullets, brackets and separators around timestamps', () => {
    const chapters = parseChaptersFromDescription('- (00:00) — Start\n• 01:00 | Middle\n02:00: End');
    assert.deepEqual(chapters.map((c) => c.title), ['Start', 'Middle', 'End']);
  });

  it('is not a chapter list when it does not start at 0:00', () => {
    assert.deepEqual(parseChaptersFromDescription('0:10 A\n1:00 B\n2:00 C'), []);
  });

  it('is not a chapter list with fewer than three timestamps', () => {
    assert.deepEqual(parseChaptersFromDescription('0:00 A\n1:00 B'), []);
  });

  it('is not a chapter list when timestamps go backwards', () => {
    assert.deepEqual(parseChaptersFromDescription('0:00 A\n5:00 B\n4:00 C'), []);
  });

  it('returns nothing for a missing description', () => {
    assert.deepEqual(parseChaptersFromDescription(null), []);
  });
});

describe('durations', () => {
  it('parses ISO 8601 durations from the YouTube API', () => {
    assert.equal(parseIsoDuration('PT54M12S'), 3252);
    assert.equal(parseIsoDuration('PT1H2M'), 3720);
    assert.equal(parseIsoDuration('P1DT1S'), 86401);
    assert.equal(parseIsoDuration('garbage'), 0);
  });

  it('formats as m:ss under an hour and h:mm:ss above', () => {
    assert.equal(formatDuration(3252), '54:12');
    assert.equal(formatDuration(3725), '1:02:05');
    assert.equal(formatDuration(5), '0:05');
  });
});

describe('parseChannelRef', () => {
  const id = 'UC' + 'a'.repeat(22);

  it('understands every channel URL form', () => {
    assert.deepEqual(parseChannelRef('https://www.youtube.com/@varlamov'), { kind: 'handle', value: 'varlamov' });
    assert.deepEqual(parseChannelRef('@varlamov'), { kind: 'handle', value: 'varlamov' });
    assert.deepEqual(parseChannelRef(`youtube.com/channel/${id}`), { kind: 'id', value: id });
    assert.deepEqual(parseChannelRef(id), { kind: 'id', value: id });
    assert.deepEqual(parseChannelRef('https://youtube.com/user/oldname'), { kind: 'username', value: 'oldname' });
    assert.deepEqual(parseChannelRef('https://youtube.com/c/Custom'), { kind: 'custom', value: 'Custom' });
  });

  it('rejects video links and foreign hosts', () => {
    assert.equal(parseChannelRef('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), null);
    assert.equal(parseChannelRef('https://vimeo.com/@someone'), null);
    assert.equal(parseChannelRef(''), null);
  });
});

describe('extractYoutubeVideoId', () => {
  it('finds the id in every common link form', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
    ]) {
      assert.equal(extractYoutubeVideoId(url), 'dQw4w9WgXcQ', url);
    }
  });

  it('rejects malformed ids', () => {
    assert.equal(extractYoutubeVideoId('https://www.youtube.com/watch?v=short'), null);
    assert.equal(extractYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  });
});
