import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/app.config';
import { buildLlmRouter } from './build-llm-router';
import { LlmContextService } from './llm-context.service';
import { LlmService } from './llm.service';
import { LLM_PROVIDER, LlmProvider } from './llm.types';
import { MockLlmProvider } from './providers/mock-llm.provider';

@Global()
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): LlmProvider => {
        const llm = config.get('llm', { infer: true });
        if (llm.mode === 'mock') return new MockLlmProvider();
        return buildLlmRouter(llm);
      },
    },
    LlmContextService,
    LlmService,
  ],
  exports: [LlmContextService, LlmService],
})
export class LlmModule {}
