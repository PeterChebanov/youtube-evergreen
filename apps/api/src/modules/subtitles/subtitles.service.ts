import { Inject, Injectable } from '@nestjs/common';
import type { LlmStageId, SubtitleCheck, SubtitlesFetchRequest } from '@youtube-ai-tool/shared';
import { LlmContextService } from '../llm/llm-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import { ResearchService } from '../library/research.service';
import { UNAVAILABLE } from '../library/video-sync';
import { VideoIngestService } from '../library/video-ingest.service';
import type { YoutubeVideo } from '../youtube/youtube.gateway';
import { YoutubeService } from '../youtube/youtube.service';
import { missingConfirmation, resolveSubtitleScenario } from './subtitle-scenario';
import { SUBTITLE_PROVIDER, SubtitleProvider } from './subtitle.provider';

export type SubtitlesFetchResult =
  | { outcome: 'confirmation_required'; confirmation: string; check: SubtitleCheck }
  | { outcome: 'saved' | 'unavailable'; check: SubtitleCheck };

/** Subtitles are fetched only on an explicit request, one video at a time (REQUIREMENTS 6). */
@Injectable()
export class SubtitlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YoutubeService,
    private readonly research: ResearchService,
    private readonly ingest: VideoIngestService,
    private readonly analysis: AnalysisService,
    private readonly llmContext: LlmContextService,
    @Inject(SUBTITLE_PROVIDER) private readonly provider: SubtitleProvider,
  ) {}

  async check(url: string): Promise<SubtitleCheck> {
    return this.describe(await this.youtube.videoByUrl(url));
  }

  async fetch(req: SubtitlesFetchRequest): Promise<SubtitlesFetchResult> {
    const yt = await this.youtube.videoByUrl(req.url);
    const check = await this.describe(yt);
    const confirmation = missingConfirmation(check.scenario, req);
    if (confirmation) return { outcome: 'confirmation_required', confirmation, check };

    const videoId = check.videoId ?? (await this.addToLibrary(yt));
    const saved = await this.download(videoId, yt.youtubeVideoId);
    return { outcome: saved ? 'saved' : 'unavailable', check: await this.describe(yt) };
  }

  async analyze(videoId: string, llmModelOverrides?: Partial<Record<LlmStageId, string>>) {
    return this.llmContext.withRunOverrides(llmModelOverrides ?? {}, () => this.analysis.analyzeTranscript(videoId));
  }

  /** Adds the video, creating a partial channel when needed (6.1.3, 6.1.4); a partial channel gets no AuthorStyle. */
  private async addToLibrary(yt: YoutubeVideo): Promise<string> {
    let channel = await this.prisma.channel.findUnique({ where: { youtubeChannelId: yt.youtubeChannelId } });
    if (!channel) channel = await this.research.upsertPartialChannel(await this.youtube.channelById(yt.youtubeChannelId, { interactive: true }));
    const videoId = await this.ingest.addSingle(channel.id, yt);
    await this.analysis.analyzeBasic([videoId]);
    return videoId;
  }

  private async download(videoId: string, youtubeVideoId: string): Promise<boolean> {
    await this.prisma.video.update({ where: { id: videoId }, data: { transcriptStatus: 'fetching' } });
    try {
      const text = await this.provider.fetch(youtubeVideoId);
      await this.prisma.video.update({
        where: { id: videoId },
        data: text ? { transcript: text, transcriptStatus: 'done' } : { transcript: UNAVAILABLE, transcriptStatus: 'unavailable' },
      });
      return !!text;
    } catch (e) {
      await this.prisma.video.update({ where: { id: videoId }, data: { transcriptStatus: 'failed' } });
      throw e;
    }
  }

  private async describe(yt: YoutubeVideo): Promise<SubtitleCheck> {
    const [video, channel] = await Promise.all([
      this.prisma.video.findUnique({
        where: { youtubeVideoId: yt.youtubeVideoId },
        include: { analysis: { select: { transcriptAnalysis: true } } },
      }),
      this.prisma.channel.findUnique({
        where: { youtubeChannelId: yt.youtubeChannelId },
        include: { _count: { select: { videos: true } } },
      }),
    ]);
    return {
      scenario: resolveSubtitleScenario({ dbVideo: video, youtubeTitle: yt.title, channelInDb: !!channel }),
      youtubeVideoId: yt.youtubeVideoId,
      youtubeTitle: yt.title,
      dbTitle: video?.title ?? null,
      youtubeChannelId: yt.youtubeChannelId,
      channelName: channel?.channelName ?? yt.channelTitle,
      channelInDb: !!channel,
      channelStatus: channel?.researchStatus ?? null,
      channelVideoCount: channel?._count.videos ?? null,
      durationSec: yt.durationSec,
      videoId: video?.id ?? null,
      transcriptStatus: video?.transcriptStatus ?? null,
      transcriptAnalysis: (video?.analysis?.transcriptAnalysis as Record<string, unknown> | null) ?? null,
    };
  }
}
