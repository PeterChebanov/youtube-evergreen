import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { chapterTextRequestSchema, feedbackRequestSchema } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { WriterService } from './writer.service';

@ApiTags('writer')
@Controller('projects/:projectId/script')
export class WriterController {
  constructor(private readonly writer: WriterService) {}

  @Get()
  state(@Param('projectId') projectId: string) {
    return this.writer.state(projectId);
  }

  @Get('export')
  @Header('content-type', 'text/markdown; charset=utf-8')
  export(@Param('projectId') projectId: string) {
    return this.writer.exportMarkdown(projectId);
  }

  @Post('finalize')
  finalize(@Param('projectId') projectId: string) {
    return this.writer.finalize(projectId);
  }

  @Post('chapters/:order/write')
  write(@Param('projectId') projectId: string, @Param('order', ParseIntPipe) order: number) {
    return this.writer.write(projectId, order);
  }

  @Post('chapters/:order/refine')
  @ApiZodBody(feedbackRequestSchema)
  refine(
    @Param('projectId') projectId: string,
    @Param('order', ParseIntPipe) order: number,
    @Body(new ZodPipe(feedbackRequestSchema)) body: z.output<typeof feedbackRequestSchema>,
  ) {
    return this.writer.refine(projectId, order, body.feedback);
  }

  @Put('chapters/:order')
  @ApiZodBody(chapterTextRequestSchema)
  save(
    @Param('projectId') projectId: string,
    @Param('order', ParseIntPipe) order: number,
    @Body(new ZodPipe(chapterTextRequestSchema)) body: z.output<typeof chapterTextRequestSchema>,
  ) {
    return this.writer.saveManual(projectId, order, body.text);
  }

  @Post('chapters/:order/approve')
  approve(@Param('projectId') projectId: string, @Param('order', ParseIntPipe) order: number) {
    return this.writer.approve(projectId, order);
  }
}
