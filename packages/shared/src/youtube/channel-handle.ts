/** Display/search label: `@Toplesofficial` (no double `@`). */
export function formatChannelHandleLabel(handle: string | null | undefined): string | null {
  const raw = handle?.trim();
  if (!raw) return null;
  const body = raw.startsWith('@') ? raw.slice(1) : raw;
  if (!body) return null;
  return `@${body}`;
}

export function normalizeYoutubeHandle(input: string | null | undefined): string | null {
  const label = formatChannelHandleLabel(input);
  return label ? label.slice(1) : null;
}
