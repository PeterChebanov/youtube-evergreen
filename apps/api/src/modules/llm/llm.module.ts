import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/app.config';
import { LlmService } from './llm.service';
import { LLM_PROVIDER, LlmProvider } from './llm.types';
import { MockLlmProvider } from './providers/mock-llm.provider';
import { OpenAiLlmProvider } from './providers/openai-llm.provider';

@Global()
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): LlmProvider => {
        const llm = config.get('llm', { infer: true });
        if (llm.provider !== 'openai') return new MockLlmProvider();
        if (!llm.openaiApiKey) throw new Error('LLM_PROVIDER=openai requires OPENAI_API_KEY');
        return new OpenAiLlmProvider(llm.openaiApiKey);
      },
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
