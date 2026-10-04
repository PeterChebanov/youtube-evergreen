const PATTERNS = [
  /\b(data ?base|db|library)\b/i,
  /(^|[^\p{L}])(база|базе|базу|базы|базой|бд|библиотек[аеиуы]|библиотекой|ресерч\p{L}*)(?!\p{L})/iu,
  /(youtube\.com|youtu\.be)\//i,
  /\b(my|our) (videos?|channels?)\b/i,
  /(мои|наши|моих|наших) (ролик|видео|канал)/iu,
];

/**
 * Whether free text asks to use the research library (REQUIREMENTS P4):
 * explicit words like "database", a YouTube link, or a researched channel's name.
 */
export function referencesDatabase(text: string, channelNames: readonly string[] = []): boolean {
  if (!text.trim()) return false;
  if (PATTERNS.some((p) => p.test(text))) return true;
  const lower = text.toLowerCase();
  return channelNames.some((n) => n.trim().length >= 3 && lower.includes(n.trim().toLowerCase()));
}
