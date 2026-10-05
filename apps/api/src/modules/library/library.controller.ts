import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  channelRerunRequestSchema,
  channelUrlRequestSchema,
  researchPreviewRequestSchema,
  startResearchRequestSchema,
  subtitlesCheckRequestSchema,
} from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { AnalysisService } from '../analysis/analysis.service';
import { ResearchService } from './research.service';
import { SingleVideoService } from './single-video.service';

type ChannelUrlBody = z.output<typeof channelUrlRequestSchema>;

@ApiTags('library')
@Controller('library')
export class LibraryController {
  constructor(
    private readonly research: ResearchService,
    private readonly singleVideo: SingleVideoService,
    private readonly analysis: AnalysisService,
  ) {}

  @Post('research/preview')
  @ApiZodBody(researchPreviewRequestSchema)
  preview(@Body(new ZodPipe(researchPreviewRequestSchema)) body: z.output<typeof researchPreviewRequestSchema>) {
    return this.research.preview(body.channelUrl, body);
  }

  @Post('research')
  @ApiZodBody(startResearchRequestSchema)
  start(@Body(new ZodPipe(startResearchRequestSchema)) body: z.output<typeof startResearchRequestSchema>) {
    return this.research.start(body.channelUrl, body.llmModelOverrides, body);
  }

  @Post('research-jobs/:id/retry')
  retry(@Param('id') id: string) {
    return this.research.retry(id);
  }

  @Post('refresh')
  refresh() {
    return this.research.refreshAll();
  }

  @Get('channels')
  channels() {
    return this.research.listChannels();
  }

  @Get('channels/:id')
  channel(@Param('id') id: string) {
    return this.research.detail(id);
  }

  @Get('channels/:id/videos')
  channelVideos(@Param('id') id: string) {
    return this.research.channelVideos(id);
  }

  @Post('channels/:id/rerun')
  @ApiZodBody(channelRerunRequestSchema)
  rerun(@Param('id') id: string, @Body(new ZodPipe(channelRerunRequestSchema)) body: z.output<typeof channelRerunRequestSchema>) {
    return this.research.rerun(id, body.llmModelOverrides);
  }

  @Post('channels/:id/reanalyze')
  reanalyze(@Param('id') id: string) {
    return this.research.reanalyze(id);
  }

  @Get('videos/:id')
  video(@Param('id') id: string) {
    return this.singleVideo.storedView(id);
  }

  @Post('videos/:id/structure')
  async structure(@Param('id') id: string) {
    await this.analysis.ensureStructure(id);
    return this.singleVideo.storedView(id);
  }

  @Post('videos/snapshot')
  @ApiZodBody(subtitlesCheckRequestSchema)
  snapshot(@Body(new ZodPipe(subtitlesCheckRequestSchema)) body: z.output<typeof subtitlesCheckRequestSchema>) {
    return this.singleVideo.snapshot(body.url);
  }
}
