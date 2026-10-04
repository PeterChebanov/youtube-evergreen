import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { GenresModule } from '../genres/genres.module';
import { LibraryController } from './library.controller';
import { ResearchProcessor } from './research.processor';
import { ResearchService } from './research.service';
import { SingleVideoService } from './single-video.service';
import { VideoIngestService } from './video-ingest.service';

@Module({
  imports: [AnalysisModule, GenresModule],
  controllers: [LibraryController],
  providers: [ResearchService, ResearchProcessor, VideoIngestService, SingleVideoService],
  exports: [ResearchService, VideoIngestService, SingleVideoService],
})
export class LibraryModule {}
