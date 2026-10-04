import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { FactResearchModule } from '../fact-research/fact-research.module';
import { ProjectsModule } from '../projects/projects.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  imports: [ProjectsModule, AnalysisModule, FactResearchModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
