import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppConfig } from '../../config/app.config';
import type { PromptName } from '../llm/prompt-names';

export const PROMPT_FILES: Record<PromptName, string> = {
  video_basic: 'video-basic-analysis.md',
  video_structure: 'video-structure.md',
  author_style: 'author-style.md',
  genre_practices: 'genre-practices.md',
  channel_style: 'channel-style-draft.md',
  transcript_analysis: 'transcript-analysis.md',
  advice: 'advice.md',
  planning: 'planning.md',
  research_queries: 'research.md',
  fact_extract: 'fact-extract.md',
  writer: 'writer-base.md',
  writer_refine: 'writer-refine.md',
  chapter_summary: 'chapter-summary.md',
};

export const RETENTION_BASE_FILE = 'retention-base.md';
export const DB_PRIORITY_FILE = 'fragments/db-priority.md';

/** Reads versioned prompt files; a missing file is a deployment error, never silently replaced. */
@Injectable()
export class PromptsService {
  private readonly dir: string;
  private readonly cache = new Map<string, string>();

  constructor(config: ConfigService<AppConfig, true>) {
    this.dir = config.get('promptsDir', { infer: true });
  }

  forPrompt(name: PromptName): Promise<string> {
    return this.file(PROMPT_FILES[name]);
  }

  async file(relativePath: string): Promise<string> {
    const cached = this.cache.get(relativePath);
    if (cached !== undefined) return cached;
    const path = join(this.dir, relativePath);
    const body = (await readFile(path, 'utf8').catch(() => {
      throw new Error(`Prompt file is missing: ${path}`);
    })).trim();
    this.cache.set(relativePath, body);
    return body;
  }
}
