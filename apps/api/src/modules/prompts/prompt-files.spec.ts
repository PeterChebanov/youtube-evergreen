import {
  adviceDraftSchema,
  authorStyleResponseSchema,
  channelStyleDraftSchema,
  chapterSummarySchema,
  factExtractSchema,
  genrePracticesSchema,
  planDraftSchema,
  researchQueriesSchema,
  transcriptAnalysisSchema,
  videoBasicBatchSchema,
  videoStructureSchema,
  writerChapterSchema,
} from '@youtube-ai-tool/shared';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { appConfig, AppConfig } from '../../config/app.config';
import { PROMPT_NAMES, PromptName } from '../llm/prompt-names';
import { DB_PRIORITY_FILE, PromptsService, RETENTION_BASE_FILE } from './prompts.service';

const OUTPUT: Partial<Record<PromptName, z.ZodTypeAny>> = {
  video_basic: videoBasicBatchSchema,
  video_structure: videoStructureSchema,
  author_style: authorStyleResponseSchema,
  genre_practices: genrePracticesSchema,
  channel_style: channelStyleDraftSchema,
  transcript_analysis: transcriptAnalysisSchema,
  advice: adviceDraftSchema,
  planning: planDraftSchema,
  research_queries: researchQueriesSchema,
  fact_extract: factExtractSchema,
  writer: writerChapterSchema,
  chapter_summary: chapterSummarySchema,
};

function topLevelKeys(schema: z.ZodTypeAny): string[] {
  let s: z.ZodTypeAny = schema;
  while (s instanceof z.ZodEffects) s = s.innerType();
  return s instanceof z.ZodObject ? Object.keys(s.shape) : [];
}

describe('prompt files', () => {
  const prompts = new PromptsService(new ConfigService(appConfig()) as unknown as ConfigService<AppConfig, true>);

  it.each(PROMPT_NAMES)('%s has a prompt file', async (name) => {
    expect((await prompts.forPrompt(name)).length).toBeGreaterThan(100);
  });

  it.each(Object.entries(OUTPUT))('%s describes every field its reply must contain', async (name, schema) => {
    const text = await prompts.forPrompt(name as PromptName);
    for (const key of topLevelKeys(schema!)) expect(text).toContain(`"${key}"`);
  });

  it('ships the shared retention base and database fragment', async () => {
    expect(await prompts.file(RETENTION_BASE_FILE)).toMatch(/riddle/i);
    expect(await prompts.file(DB_PRIORITY_FILE)).toContain('dbDataUsed');
  });

  it('fails loudly when a prompt file is missing', async () => {
    await expect(prompts.file('missing.md')).rejects.toThrow('Prompt file is missing');
  });
});
