import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/app.config';
import { AnalysisModule } from '../analysis/analysis.module';
import { LibraryModule } from '../library/library.module';
import { MockSubtitleProvider, SUBTITLE_PROVIDER, YtDlpSubtitleProvider } from './subtitle.provider';
import { SubtitlesController } from './subtitles.controller';
import { SubtitlesService } from './subtitles.service';

@Module({
  imports: [LibraryModule, AnalysisModule],
  controllers: [SubtitlesController],
  providers: [
    SubtitlesService,
    {
      provide: SUBTITLE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const cfg = config.get('subtitles', { infer: true });
        return cfg.provider === 'mock' ? new MockSubtitleProvider() : new YtDlpSubtitleProvider(cfg);
      },
    },
  ],
})
export class SubtitlesModule {}
