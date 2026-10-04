import { ChannelRef, parseIsoDuration } from '@youtube-ai-tool/shared';
import { unavailable } from '../../common/domain-error';
import type { UploadsPage, YoutubeChannel, YoutubeGateway, YoutubeVideo } from './youtube.gateway';

const API = 'https://www.googleapis.com/youtube/v3';

type ApiChannel = {
  id: string;
  snippet: { title: string; description?: string };
  statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
  contentDetails: { relatedPlaylists: { uploads: string } };
};

type ApiVideo = {
  id: string;
  snippet: { channelId: string; channelTitle: string; title: string; description?: string; publishedAt: string };
  statistics?: { viewCount?: string };
  contentDetails: { duration: string };
};

export class YoutubeApiGateway implements YoutubeGateway {
  constructor(private readonly apiKey: string) {}

  async resolveChannel(ref: ChannelRef): Promise<YoutubeChannel | null> {
    const params: Record<string, string> = { part: 'snippet,statistics,contentDetails' };
    if (ref.kind === 'id') params.id = ref.value;
    else if (ref.kind === 'handle') params.forHandle = `@${ref.value}`;
    else if (ref.kind === 'username') params.forUsername = ref.value;
    else params.forHandle = `@${ref.value}`;
    const res = await this.get<{ items?: ApiChannel[] }>('channels', params);
    const c = res.items?.[0];
    if (!c) return null;
    return {
      youtubeChannelId: c.id,
      title: c.snippet.title,
      description: c.snippet.description?.trim() || null,
      subscribers: c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount ?? 0) || null,
      videoCount: Number(c.statistics?.videoCount ?? 0),
      uploadsPlaylistId: c.contentDetails.relatedPlaylists.uploads,
    };
  }

  async listUploads(playlistId: string, pageToken: string | null): Promise<UploadsPage> {
    const res = await this.get<{ items?: Array<{ contentDetails: { videoId: string } }>; nextPageToken?: string }>(
      'playlistItems',
      { part: 'contentDetails', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) },
    );
    return { videoIds: (res.items ?? []).map((i) => i.contentDetails.videoId), nextPageToken: res.nextPageToken ?? null };
  }

  async getVideos(ids: string[]): Promise<YoutubeVideo[]> {
    if (!ids.length) return [];
    const res = await this.get<{ items?: ApiVideo[] }>('videos', {
      part: 'snippet,statistics,contentDetails',
      id: ids.slice(0, 50).join(','),
      maxResults: '50',
    });
    return (res.items ?? []).map((v) => ({
      youtubeVideoId: v.id,
      youtubeChannelId: v.snippet.channelId,
      channelTitle: v.snippet.channelTitle,
      title: v.snippet.title,
      description: v.snippet.description?.trim() || null,
      publishedAt: new Date(v.snippet.publishedAt),
      views: Number(v.statistics?.viewCount ?? 0),
      durationSec: parseIsoDuration(v.contentDetails.duration),
    }));
  }

  private async get<T>(resource: string, params: Record<string, string>): Promise<T> {
    const url = `${API}/${resource}?${new URLSearchParams({ ...params, key: this.apiKey })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      const body = await res.text();
      throw unavailable(`YouTube API ${resource} failed with ${res.status}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }
}
