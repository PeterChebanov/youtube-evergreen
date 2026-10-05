import { Injectable } from '@nestjs/common';
import type { LlmStageId } from '@youtube-ai-tool/shared';

/** Carries per-run LLM overrides (e.g. channel research job) into nested services. */
@Injectable()
export class LlmContextService {
  private stack: Array<Partial<Record<LlmStageId, string>>> = [];

  runOverrides(): Partial<Record<LlmStageId, string>> | undefined {
    return this.stack.at(-1);
  }

  async withRunOverrides<T>(overrides: Partial<Record<LlmStageId, string>>, fn: () => Promise<T>): Promise<T> {
    this.stack.push(overrides);
    try {
      return await fn();
    } finally {
      this.stack.pop();
    }
  }
}
