import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { AdviceController } from './advice.controller';
import { AdviceService } from './advice.service';

@Module({ imports: [AnalysisModule], controllers: [AdviceController], providers: [AdviceService] })
export class AdviceModule {}
