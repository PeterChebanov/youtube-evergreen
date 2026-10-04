import { Global, Module } from '@nestjs/common';
import { PromptComposer } from './prompt-composer.service';
import { PromptsService } from './prompts.service';

@Global()
@Module({ providers: [PromptsService, PromptComposer], exports: [PromptsService, PromptComposer] })
export class PromptsModule {}
