import { describe, expect, it } from 'vitest';
import { clock, daysAgo, minutesClock, paragraphs, plural, shortUrl, whenLabel } from './format';
import { createChordReader, screenFromHash } from './screens';

describe('format', () => {
  it('shows durations as m:ss below an hour and h:mm:ss from one hour', () => {
    expect(clock(212)).toBe('3:32');
    expect(clock(3252)).toBe('54:12');
    expect(clock(3725)).toBe('1:02:05');
    expect(minutesClock(47.7)).toBe('47:42');
  });

  it('names relative days the way the research table does', () => {
    const now = new Date(2026, 9, 4, 12);
    expect(daysAgo(new Date(2026, 9, 4, 1).toISOString(), now)).toBe('today');
    expect(daysAgo(new Date(2026, 9, 3, 23).toISOString(), now)).toBe('1 day ago');
    expect(daysAgo(new Date(2026, 9, 1).toISOString(), now)).toBe('3 days ago');
  });

  it('labels quota resume time as today, tomorrow or a date', () => {
    const now = new Date(2026, 9, 4, 12);
    expect(whenLabel(new Date(2026, 9, 4, 18).toISOString(), now)).toBe('today 18:00');
    expect(whenLabel(new Date(2026, 9, 5, 9).toISOString(), now)).toBe('tomorrow 09:00');
    expect(whenLabel(new Date(2026, 9, 8, 9, 30).toISOString(), now)).toBe('2026-10-08 09:30');
  });

  it('pluralizes and groups thousands', () => {
    expect(plural(1, 'video')).toBe('1 video');
    expect(plural(14382, 'video')).toBe('14,382 videos');
  });

  it('shortens URLs and splits text into paragraphs', () => {
    expect(shortUrl('https://www.example.org/a/b/')).toBe('example.org/a/b');
    expect(paragraphs('One.\n\n  Two.\n \nThree.')).toEqual(['One.', 'Two.', 'Three.']);
  });
});

describe('navigation', () => {
  it('falls back to Research for unknown hashes', () => {
    expect(screenFromHash('#writer')).toBe('writer');
    expect(screenFromHash('#/style')).toBe('style');
    expect(screenFromHash('#nope')).toBe('research');
  });

  it('jumps on "g" followed by a tab key within the chord window', () => {
    let t = 0;
    const read = createChordReader(() => t);
    expect(read('g')).toBeNull();
    t = 500;
    expect(read('w')).toBe('writer');
    expect(read('w')).toBeNull();
  });

  it('ignores the second key once the chord window has passed', () => {
    let t = 0;
    const read = createChordReader(() => t);
    read('g');
    t = 2000;
    expect(read('d')).toBeNull();
  });
});
