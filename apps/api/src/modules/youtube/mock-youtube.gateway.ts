import type { ChannelRef } from '@youtube-ai-tool/shared';
import type { UploadsPage, YoutubeChannel, YoutubeGateway, YoutubeVideo } from './youtube.gateway';

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const PAGE_SIZE = 5;

function hashId(seed: string, length: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  let out = '';
  while (out.length < length) {
    h = Math.imul(h ^ out.length, 16777619) >>> 0;
    out += ID_CHARS[(h >>> 7) % ID_CHARS.length];
  }
  return out;
}

const TOPICS = [
  'The fall of the Soviet Union',
  'Chernobyl: the night of the accident',
  'Why Pripyat became a ghost town',
  'How a prison works from the inside',
  'The great tulip bubble',
  'Who really built the pyramids?',
  'The Dyatlov Pass mystery',
  'How Nokia lost the phone market',
  'The man who sold the Eiffel Tower',
  'Breaking news this week',
  'Short clip',
  'Life in a medieval city',
];

const CHAPTERED = '0:00 Cold open\n4:10 How it started\n18:30 The turning point\n41:00 What it means';

/**
 * Offline stand-in for the YouTube Data API: every channel ref resolves to a
 * deterministic channel with 12 uploads (one short, one news, one without a
 * description), paged by 5 so resumable collection is exercised.
 */
export class MockYoutubeGateway implements YoutubeGateway {
  private readonly videoOwner = new Map<string, YoutubeChannel>();

  async resolveChannel(ref: ChannelRef): Promise<YoutubeChannel> {
    const youtubeChannelId = ref.kind === 'id' ? ref.value : `UC${hashId(ref.value.toLowerCase(), 22)}`;
    const name = ref.kind === 'id' ? `Channel ${ref.value.slice(2, 8)}` : ref.value;
    return {
      youtubeChannelId,
      title: `Mock ${name}`,
      description: `Offline channel ${name}`,
      subscribers: 100_000,
      videoCount: TOPICS.length,
      uploadsPlaylistId: `UU${youtubeChannelId.slice(2)}`,
    };
  }

  async listUploads(playlistId: string, pageToken: string | null): Promise<UploadsPage> {
    const channel = await this.resolveChannel({ kind: 'id', value: `UC${playlistId.slice(2)}` });
    const start = pageToken ? Number(pageToken) : 0;
    const ids = TOPICS.slice(start, start + PAGE_SIZE).map((_, i) => hashId(`${playlistId}:${start + i}`, 11));
    ids.forEach((id) => this.videoOwner.set(id, channel));
    const next = start + PAGE_SIZE;
    return { videoIds: ids, nextPageToken: next < TOPICS.length ? String(next) : null };
  }

  async getVideos(ids: string[]): Promise<YoutubeVideo[]> {
    const videos: YoutubeVideo[] = [];
    for (const id of ids) {
      const owner = this.videoOwner.get(id) ?? (await this.resolveChannel({ kind: 'handle', value: `owner-of-${id}` }));
      const index = this.indexOf(owner, id);
      const title = TOPICS[index] ?? `Video ${id}`;
      videos.push({
        youtubeVideoId: id,
        youtubeChannelId: owner.youtubeChannelId,
        channelTitle: owner.title,
        title,
        description: index === 5 ? null : index % 2 === 0 ? `${title}.\n\n${CHAPTERED}` : `${title}. A long story told slowly.`,
        publishedAt: new Date(Date.UTC(2018 + (index % 6), index % 12, 10)),
        views: 50_000 + ((index * 7919) % 20) * 25_000,
        durationSec: title === 'Short clip' ? 45 : 2400 + index * 120,
      });
    }
    return videos;
  }

  private indexOf(owner: YoutubeChannel, id: string): number {
    for (let i = 0; i < TOPICS.length; i++) {
      if (hashId(`${owner.uploadsPlaylistId}:${i}`, 11) === id) return i;
    }
    return 0;
  }
}
