import { Inject, Injectable } from '@nestjs/common';
import { extractYoutubeVideoId, parseChannelRef } from '@youtube-ai-tool/shared';
import { invalid, notFound } from '../../common/domain-error';
import { QUOTA_COST } from './quota';
import { QuotaService } from './quota.service';
import { YOUTUBE_GATEWAY, YoutubeChannel, YoutubeGateway, YoutubeVideo } from './youtube.gateway';

type CallOptions = { interactive?: boolean };

/** YouTube access with quota accounting on every request. */
@Injectable()
export class YoutubeService {
  constructor(
    @Inject(YOUTUBE_GATEWAY) private readonly gateway: YoutubeGateway,
    private readonly quota: QuotaService,
  ) {}

  async resolveChannelUrl(input: string, opts: CallOptions = {}): Promise<YoutubeChannel> {
    const ref = parseChannelRef(input);
    if (!ref) throw invalid(`Not a YouTube channel link: ${input}`);
    await this.quota.consume(QUOTA_COST.channels, opts);
    const channel = await this.gateway.resolveChannel(ref);
    if (!channel) throw notFound(`YouTube channel ${input}`);
    return channel;
  }

  async channelById(youtubeChannelId: string, opts: CallOptions = {}): Promise<YoutubeChannel> {
    await this.quota.consume(QUOTA_COST.channels, opts);
    const channel = await this.gateway.resolveChannel({ kind: 'id', value: youtubeChannelId });
    if (!channel) throw notFound(`YouTube channel ${youtubeChannelId}`);
    return channel;
  }

  async listUploads(playlistId: string, pageToken: string | null) {
    await this.quota.consume(QUOTA_COST.playlistItems);
    return this.gateway.listUploads(playlistId, pageToken);
  }

  async getVideos(ids: string[], opts: CallOptions = {}): Promise<YoutubeVideo[]> {
    if (!ids.length) return [];
    await this.quota.consume(QUOTA_COST.videos, opts);
    return this.gateway.getVideos(ids);
  }

  async videoByUrl(url: string): Promise<YoutubeVideo> {
    const id = extractYoutubeVideoId(url);
    if (!id) throw invalid(`Not a YouTube video link: ${url}`);
    const [video] = await this.getVideos([id], { interactive: true });
    if (!video) throw notFound(`YouTube video ${id}`);
    return video;
  }
}
