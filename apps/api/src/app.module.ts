import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { AdviceModule } from './modules/advice/advice.module';
import { DatabaseViewModule } from './modules/database-view/database-view.module';
import { DbToolsModule } from './modules/db-tools/db-tools.module';
import { FactResearchModule } from './modules/fact-research/fact-research.module';
import { GenresModule } from './modules/genres/genres.module';
import { HealthModule } from './modules/health/health.module';
import { LibraryModule } from './modules/library/library.module';
import { LlmModule } from './modules/llm/llm.module';
import { MyVideosModule } from './modules/my-videos/my-videos.module';
import { OpsModule } from './modules/ops/ops.module';
import { PlanningModule } from './modules/planning/planning.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { QueueModule } from './modules/queue/queue.module';
import { SearchModule } from './modules/search/search.module';
import { StyleModule } from './modules/style/style.module';
import { SubtitlesModule } from './modules/subtitles/subtitles.module';
import { WriterModule } from './modules/writer/writer.module';
import { YoutubeModule } from './modules/youtube/youtube.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    QueueModule,
    LlmModule,
    PromptsModule,
    YoutubeModule,
    SearchModule,
    DbToolsModule,
    HealthModule,
    GenresModule,
    LibraryModule,
    StyleModule,
    AdviceModule,
    ProjectsModule,
    PlanningModule,
    FactResearchModule,
    WriterModule,
    SubtitlesModule,
    DatabaseViewModule,
    MyVideosModule,
    OpsModule,
  ],
})
export class AppModule {}
