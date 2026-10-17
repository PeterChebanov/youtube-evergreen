import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { adviceFiltersSchema, adviceRefineRequestSchema, type AdviceFilters } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { AdviceService } from './advice.service';

@ApiTags('advice')
@Controller('advice')
export class AdviceController {
  constructor(private readonly advice: AdviceService) {}

  @Post()
  @ApiZodBody(adviceFiltersSchema)
  run(@Body(new ZodPipe(adviceFiltersSchema)) filters: AdviceFilters) {
    return this.advice.run(filters);
  }

  @Get('runs')
  history() {
    return this.advice.history();
  }

  @Get('library')
  library() {
    return this.advice.library();
  }

  @Post('refine')
  @ApiZodBody(adviceRefineRequestSchema)
  refine(@Body(new ZodPipe(adviceRefineRequestSchema)) body: z.output<typeof adviceRefineRequestSchema>) {
    return this.advice.refineTopic(body.runId, body.topicIndex, body.feedback, body.llmModelOverrides);
  }
}
