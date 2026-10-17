import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  addPlanChapterRequestSchema,
  feedbackRequestSchema,
  manualPlanRequestSchema,
  optionalFeedbackRequestSchema,
  type PlanDraft,
} from '@youtube-ai-tool/shared';
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

  @Post('refine-all')
  @HttpCode(201)
  refineAll(@Param('projectId') projectId: string) {
    return this.planning.refineAllChapters(projectId);
  }

  @Post('chapters/:order/refine')
  @HttpCode(201)
  @ApiZodBody(feedbackRequestSchema)
  refineChapter(
    @Param('projectId') projectId: string,
    @Param('order', ParseIntPipe) order: number,
    @Body(new ZodPipe(feedbackRequestSchema)) body: z.output<typeof feedbackRequestSchema>,
  ) {
    return this.planning.refineChapter(projectId, order, body.feedback);
  }

  @Post('chapters/:order/retry')
  @HttpCode(201)
  @ApiZodBody(optionalFeedbackRequestSchema)
  retryChapter(
    @Param('projectId') projectId: string,
    @Param('order', ParseIntPipe) order: number,
    @Body(new ZodPipe(optionalFeedbackRequestSchema)) body: z.output<typeof optionalFeedbackRequestSchema>,
  ) {
    return this.planning.retryChapter(projectId, order, body.feedback);
  }

  @Post('chapters/add')
  @HttpCode(201)
  @ApiZodBody(addPlanChapterRequestSchema)
  addChapter(
    @Param('projectId') projectId: string,
    @Body(new ZodPipe(addPlanChapterRequestSchema)) body: z.output<typeof addPlanChapterRequestSchema>,
  ) {
    return this.planning.addChapter(projectId, body);
  }

  @Put()
  @ApiZodBody(manualPlanRequestSchema)
  save(@Param('projectId') projectId: string, @Body(new ZodPipe(manualPlanRequestSchema)) body: PlanDraft) {
    return this.planning.saveManual(projectId, body);
  }

  @Post('rescale-target')
  @HttpCode(201)
  rescaleTarget(@Param('projectId') projectId: string) {
    return this.planning.rescaleToTarget(projectId);
  }

  @Post('approve')
  approve(@Param('projectId') projectId: string) {
    return this.planning.approve(projectId);
  }
}
