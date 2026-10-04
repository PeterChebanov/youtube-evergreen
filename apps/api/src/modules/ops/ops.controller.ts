import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OpsService } from './ops.service';

@ApiTags('ops')
@Controller('ops')
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('status')
  status() {
    return this.ops.status();
  }

  @Get('spend')
  spend(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.ops.spend(days);
  }

  @Get('search-options')
  searchOptions() {
    return this.ops.searchOptions();
  }

  @Get('llm-defaults')
  llmDefaults() {
    return this.ops.llmDefaults();
  }
}
