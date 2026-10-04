import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/app.config';
import { MockYoutubeGateway } from './mock-youtube.gateway';
import { QuotaService } from './quota.service';
import { YoutubeApiGateway } from './youtube-api.gateway';
import { YOUTUBE_GATEWAY } from './youtube.gateway';
import { YoutubeService } from './youtube.service';

@Global()
@Module({
  providers: [
    {
      provide: YOUTUBE_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const key = config.get('youtube', { infer: true }).apiKey;
        return key ? new YoutubeApiGateway(key) : new MockYoutubeGateway();
      },
    },
    QuotaService,
    YoutubeService,
  ],
  exports: [YoutubeService, QuotaService],
})
export class YoutubeModule {}
