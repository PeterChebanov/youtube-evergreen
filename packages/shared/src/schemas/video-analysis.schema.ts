import { z } from 'zod';

export const videoBasicBatchSchema = z.object({
  items: z.array(
    z.object({
      videoId: z.string(),
      topic: z.string(),
      subtopic: z.string().optional(),
      genre: z.string(),
      contentType: z.enum(['evergreen', 'news']),
      format: z.string(),
      titleType: z.string(),
      hook: z.string(),
    }),
  ),
});

export type VideoBasicItem = z.infer<typeof videoBasicBatchSchema>['items'][number];

export const authorStyleResponseSchema = z.object({
  techniques: z
    .array(
      z.object({
        technique: z.string(),
        description: z.string(),
        exampleVideoIds: z.array(z.string()).max(5).default([]),
      }),
    )
    .min(2)
    .max(10),
});

export const videoStructureSchema = z.object({
  chapters: z
    .array(
      z.object({
        title: z.string(),
        startTimestamp: z.string(),
        subsections: z
          .array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
              timestamp: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
});

export const transcriptAnalysisSchema = z.object({
  tone: z.string(),
  pace: z.string(),
  address: z.string(),
  humor: z.string(),
  delivery: z.string(),
  narrativeStructure: z.string(),
  retentionTechniques: z.array(z.string()),
  phrases: z.array(z.string()).max(8),
});

export type TranscriptAnalysis = z.infer<typeof transcriptAnalysisSchema>;

export const genrePracticesSchema = z.object({
  retentionBestPractices: z.string(),
  promptModule: z.string(),
});

export const channelStyleDraftSchema = z.object({
  voice: z.string(),
  themes: z.string(),
  techniques: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      fromAuthorStyleIds: z.array(z.string()).default([]),
    }),
  ),
  retentionRules: z.string(),
});
