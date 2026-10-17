export type FullScriptChapter = { order: number; title: string; text: string };

const CHAPTER_HEADING = /^## Chapter (\d+):[^\n]*\n\n/m;

/** Build editable full script from chapters that already have text. */
export function formatFullScript(chapters: FullScriptChapter[]): string {
  return chapters
    .filter((c) => c.text.trim())
    .map((c) => `## Chapter ${c.order}: ${c.title}\n\n${c.text.trim()}`)
    .join('\n\n');
}

/** Parse headings back into chapter order → body text. */
export function parseFullScript(fullText: string): Map<number, string> {
  const out = new Map<number, string>();
  const parts = fullText.split(CHAPTER_HEADING);
  for (let i = 1; i < parts.length; i += 2) {
    const order = Number(parts[i]);
    const body = parts[i + 1]?.trim() ?? '';
    if (order > 0 && body) out.set(order, body);
  }
  return out;
}
