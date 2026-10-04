import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { FactResearchController } from './fact-research.controller';
import { FactResearchProcessor } from './fact-research.processor';
import { FactResearchService } from './fact-research.service';

@Module({
  imports: [ProjectsModule],
  controllers: [FactResearchController],
  providers: [FactResearchService, FactResearchProcessor],
  exports: [FactResearchService],
})
export class FactResearchModule {}
