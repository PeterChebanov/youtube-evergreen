const TIMING = /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->/;

/**
 * Plain transcript from a WebVTT file. Auto-generated captions repeat the
 * previous line in every cue, so consecutive duplicates are dropped.
 */
export function vttToText(vtt: string): string {
  const lines: string[] = [];
  let skippingBlock = false;
  for (const raw of vtt.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      skippingBlock = false;
      continue;
    }
    if (skippingBlock) continue;
    if (/^(WEBVTT|Kind:|Language:)/.test(line)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) {
      skippingBlock = true;
      continue;
    }
    if (TIMING.test(line) || /^\d+$/.test(line)) continue;
    const text = line
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text && text !== lines.at(-1)) lines.push(text);
  }
  return lines.join('\n');
}
