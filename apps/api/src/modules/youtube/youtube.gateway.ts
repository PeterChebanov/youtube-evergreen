import type { ChannelRef } from '@youtube-ai-tool/shared';

export type YoutubeChannel = {
  youtubeChannelId: string;
  title: string;
  description: string | null;
  subscribers: number | null;
  videoCount: number;
  uploadsPlaylistId: string;
};

export type YoutubeVideo = {
  youtubeVideoId: string;
  youtubeChannelId: string;
  channelTitle: string;
  title: string;
  description: string | null;
  publishedAt: Date;
  views: number;
  durationSec: number;
};

export type UploadsPage = { videoIds: string[]; nextPageToken: string | null };

/** Port to the YouTube Data API; each method maps to one billable request. */
export interface YoutubeGateway {
  resolveChannel(ref: ChannelRef): Promise<YoutubeChannel | null>;
  listUploads(playlistId: string, pageToken: string | null): Promise<UploadsPage>;
  getVideos(youtubeVideoIds: string[]): Promise<YoutubeVideo[]>;
}

export const YOUTUBE_GATEWAY = Symbol('YOUTUBE_GATEWAY');
