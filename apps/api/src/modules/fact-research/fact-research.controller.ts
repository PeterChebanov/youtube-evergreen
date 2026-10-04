import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { addFactRequestSchema, factRefineRequestSchema } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { FactResearchService } from './fact-research.service';

@ApiTags('facts')
@Controller('projects/:projectId/facts')
export class FactResearchController {
  constructor(private readonly facts: FactResearchService) {}

  @Get()
  state(@Param('projectId') projectId: string) {
    return this.facts.state(projectId);
  }

  @Post('refine')
  @ApiZodBody(factRefineRequestSchema)
  refine(@Param('projectId') projectId: string, @Body(new ZodPipe(factRefineRequestSchema)) body: z.output<typeof factRefineRequestSchema>) {
    return this.facts.refine(projectId, body.feedback, body.chapterOrder);
  }

  @Post('retry')
  retry(@Param('projectId') projectId: string) {
    return this.facts.retry(projectId);
  }

  @Post()
  @ApiZodBody(addFactRequestSchema)
  add(@Param('projectId') projectId: string, @Body(new ZodPipe(addFactRequestSchema)) body: z.output<typeof addFactRequestSchema>) {
    return this.facts.addFact(projectId, body);
  }

  @Delete(':factId')
  @HttpCode(204)
  remove(@Param('projectId') projectId: string, @Param('factId') factId: string) {
    return this.facts.deleteFact(projectId, factId);
  }

  @Post('approve')
  approve(@Param('projectId') projectId: string) {
    return this.facts.approve(projectId);
  }
}
