import { z } from 'zod';

export const writerChapterSchema = z.object({
  chapterText: z.string().min(1),
  dbDataUsed: z.array(z.string()).default([]),
});

export const writerSnippetSchema = z.object({
  text: z.string().min(1),
});

export const fullScriptSaveRequestSchema = z.object({
  fullText: z.string(),
});

export const writerSnippetRefineRequestSchema = z.object({
  fragment: z.string().trim().min(1),
  instructions: z.string().trim().min(1),
});

export { chapterContinuitySchema as chapterSummarySchema } from '../narrative/continuity';

export const researchQueriesSchema = z.object({
  queries: z.array(z.string().min(2)).min(1).max(5),
});

export const FACT_RELATIONS = ['supports', 'explains', 'contrasts', 'same_pattern', 'anecdote'] as const;
export type FactRelationKind = (typeof FACT_RELATIONS)[number];

export const factExtractSchema = z.object({
  facts: z.array(
    z.object({
      text: z.string().min(1),
      sourceUrl: z.string(),
      sourceTitle: z.string().optional(),
      relations: z
        .array(z.object({ toIndex: z.number().int().min(0), kind: z.enum(FACT_RELATIONS) }))
        .default([]),
    }),
  ),
});

export type ExtractedFact = z.infer<typeof factExtractSchema>['facts'][number];
