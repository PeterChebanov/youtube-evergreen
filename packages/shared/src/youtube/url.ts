export type ChannelRef =
  | { kind: 'id'; value: string }
  | { kind: 'handle'; value: string }
  | { kind: 'username'; value: string }
  | { kind: 'custom'; value: string };

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

function toUrl(input: string): URL | null {
  const raw = input.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return YOUTUBE_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

/** Accepts `@handle`, a bare channel id, or any youtube.com channel URL form. */
export function parseChannelRef(input: string): ChannelRef | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.startsWith('@')) return { kind: 'handle', value: raw.slice(1) };
  if (CHANNEL_ID.test(raw)) return { kind: 'id', value: raw };

  const url = toUrl(raw);
  if (!url || url.hostname === 'youtu.be') return null;
  const [first, second] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!first) return null;
  if (first.startsWith('@')) return { kind: 'handle', value: first.slice(1) };
  if (first === 'channel' && second && CHANNEL_ID.test(second)) return { kind: 'id', value: second };
  if (first === 'user' && second) return { kind: 'username', value: second };
  if (first === 'c' && second) return { kind: 'custom', value: second };
  if (['watch', 'shorts', 'live', 'embed', 'playlist', 'results'].includes(first)) return null;
  return { kind: 'custom', value: first };
}

export function extractYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (VIDEO_ID.test(raw)) return raw;
  const url = toUrl(raw);
  if (!url) return null;

  let candidate: string | null = null;
  if (url.hostname === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (url.searchParams.get('v')) {
    candidate = url.searchParams.get('v');
  } else {
    const m = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
    candidate = m?.[1] ?? null;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

export function videoUrl(youtubeVideoId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
}

export function channelUrl(youtubeChannelId: string): string {
  return `https://www.youtube.com/channel/${youtubeChannelId}`;
}
