import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { feedbackRequestSchema, manualPlanRequestSchema, type PlanDraft } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { PlanningService } from './planning.service';

@ApiTags('plan')
@Controller('projects/:projectId/plan')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get()
  versions(@Param('projectId') projectId: string) {
    return this.planning.versions(projectId);
  }

  @Post('generate')
  generate(@Param('projectId') projectId: string) {
    return this.planning.generate(projectId);
  }

  @Post('refine')
  @ApiZodBody(feedbackRequestSchema)
  refine(@Param('projectId') projectId: string, @Body(new ZodPipe(feedbackRequestSchema)) body: z.output<typeof feedbackRequestSchema>) {
    return this.planning.refine(projectId, body.feedback);
  }

  @Put()
  @ApiZodBody(manualPlanRequestSchema)
  save(@Param('projectId') projectId: string, @Body(new ZodPipe(manualPlanRequestSchema)) body: PlanDraft) {
    return this.planning.saveManual(projectId, body);
  }

  @Post('approve')
  approve(@Param('projectId') projectId: string) {
    return this.planning.approve(projectId);
  }
}
