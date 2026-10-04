import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { subtitlesCheckRequestSchema, subtitlesFetchRequestSchema } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { SubtitlesService } from './subtitles.service';

@ApiTags('subtitles')
@Controller('subtitles')
export class SubtitlesController {
  constructor(private readonly subtitles: SubtitlesService) {}

  @Post('check')
  @ApiZodBody(subtitlesCheckRequestSchema)
  check(@Body(new ZodPipe(subtitlesCheckRequestSchema)) body: z.output<typeof subtitlesCheckRequestSchema>) {
    return this.subtitles.check(body.url);
  }

  @Post('fetch')
  @ApiZodBody(subtitlesFetchRequestSchema)
  fetch(@Body(new ZodPipe(subtitlesFetchRequestSchema)) body: z.output<typeof subtitlesFetchRequestSchema>) {
    return this.subtitles.fetch(body);
  }

  @Post('videos/:videoId/analyze')
  analyze(@Param('videoId') videoId: string) {
    return this.subtitles.analyze(videoId);
  }
}
