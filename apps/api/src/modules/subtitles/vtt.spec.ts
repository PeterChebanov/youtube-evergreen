import { vttToText } from './vtt';

describe('vttToText', () => {
  it('keeps spoken text and drops headers, cue numbers and timings', () => {
    const vtt = [
      'WEBVTT',
      'Kind: captions',
      'Language: en',
      '',
      '1',
      '00:00:01.000 --> 00:00:03.000 align:start position:0%',
      'Imagine a city',
      '',
      '2',
      '00:00:03.000 --> 00:00:05.000',
      'that vanished overnight.',
    ].join('\n');
    expect(vttToText(vtt)).toBe('Imagine a city\nthat vanished overnight.');
  });

  it('strips inline timing and styling tags of auto-captions', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<00:00:01.200><c> hello</c><00:00:01.500><c> world</c>';
    expect(vttToText(vtt)).toBe('hello world');
  });

  it('collapses the rolling repeats of auto-generated captions', () => {
    const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000\nfirst line\n\n00:02.000 --> 00:03.000\nfirst line\nsecond line\n\n00:03.000 --> 00:04.000\nsecond line';
    expect(vttToText(vtt)).toBe('first line\nsecond line');
  });

  it('ignores NOTE and STYLE blocks and decodes entities', () => {
    const vtt = 'WEBVTT\n\nNOTE written by hand\nsecond note line\n\nSTYLE\n::cue { color: red }\n\n00:01.000 --> 00:02.000\nTom &amp; Jerry';
    expect(vttToText(vtt)).toBe('Tom & Jerry');
  });
});
