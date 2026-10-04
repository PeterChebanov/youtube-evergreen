import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  customRequestSchema,
  pickTopicRequestSchema,
  updateProjectRequestSchema,
  type CustomRequest,
  type UpdateProjectRequest,
} from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Post('custom')
  @ApiZodBody(customRequestSchema)
  custom(@Body(new ZodPipe(customRequestSchema)) body: CustomRequest) {
    return this.projects.createFromCustomRequest(body);
  }

  @Post('from-advice')
  @ApiZodBody(pickTopicRequestSchema)
  fromAdvice(@Body(new ZodPipe(pickTopicRequestSchema)) body: z.output<typeof pickTopicRequestSchema>) {
    return this.projects.createFromAdvice(body.runId, body.topicIndex);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Patch(':id')
  @ApiZodBody(updateProjectRequestSchema)
  update(@Param('id') id: string, @Body(new ZodPipe(updateProjectRequestSchema)) body: UpdateProjectRequest) {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }
}
