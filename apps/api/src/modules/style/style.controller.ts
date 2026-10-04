import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { channelStyleRequestSchema, type ChannelStyleRequest } from '@youtube-ai-tool/shared';
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
  draft() {
    return this.style.draftFromAuthors();
  }
}
