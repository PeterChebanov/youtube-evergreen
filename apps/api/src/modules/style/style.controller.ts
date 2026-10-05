import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { channelStyleRequestSchema, llmRunOverridesRequestSchema, type ChannelStyleRequest } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { StyleService } from './style.service';

@ApiTags('style')
@Controller('style')
export class StyleController {
  constructor(private readonly style: StyleService) {}

  @Get()
  async current() {
    return { style: await this.style.latest(), updateSuggested: await this.style.updateSuggested() };
  }

  @Get('versions')
  versions() {
    return this.style.history();
  }

  @Put()
  @ApiZodBody(channelStyleRequestSchema)
  save(@Body(new ZodPipe(channelStyleRequestSchema)) body: ChannelStyleRequest) {
    return this.style.save(body);
  }

  @Post('draft')
  @ApiZodBody(llmRunOverridesRequestSchema)
  draft(@Body(new ZodPipe(llmRunOverridesRequestSchema)) body: z.output<typeof llmRunOverridesRequestSchema>) {
    return this.style.draftFromAuthors(body.llmModelOverrides);
  }
}
