import { z } from 'zod';
import { planContentSchema } from './plan.schema';

export const workspacePlanItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectTitle: z.string(),
  version: z.number().int().positive(),
  createdAt: z.string(),
  chapterCount: z.number().int().nonnegative(),
  targetDurationMin: z.number().int().positive(),
});

export const workspaceResearchItemSchema = z.object({
  projectId: z.string(),
  projectTitle: z.string(),
  factCount: z.number().int().nonnegative(),
  chapterCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const workspaceScriptItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectTitle: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'finished']),
  updatedAt: z.string(),
  wordCount: z.number().int().nonnegative(),
});

export const workspaceCatalogSchema = z.object({
  plans: z.array(workspacePlanItemSchema),
  research: z.array(workspaceResearchItemSchema),
  scripts: z.array(workspaceScriptItemSchema),
});

export const workspacePlanDetailSchema = workspacePlanItemSchema.extend({
  content: planContentSchema,
  feedback: z.string().nullable(),
});

export const workspaceResearchFactSchema = z.object({
  id: z.string(),
  planChapterOrder: z.number().int(),
  text: z.string(),
  sourceUrl: z.string(),
  sourceTitle: z.string().nullable(),
});

export const workspaceResearchDetailSchema = z.object({
  projectId: z.string(),
  projectTitle: z.string(),
  facts: z.array(workspaceResearchFactSchema),
});

export const workspaceScriptDetailSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectTitle: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'finished']),
  text: z.string(),
  updatedAt: z.string(),
});

export type WorkspacePlanItem = z.infer<typeof workspacePlanItemSchema>;
export type WorkspaceResearchItem = z.infer<typeof workspaceResearchItemSchema>;
export type WorkspaceScriptItem = z.infer<typeof workspaceScriptItemSchema>;
export type WorkspaceCatalog = z.infer<typeof workspaceCatalogSchema>;
export type WorkspacePlanDetail = z.infer<typeof workspacePlanDetailSchema>;
export type WorkspaceResearchDetail = z.infer<typeof workspaceResearchDetailSchema>;
export type WorkspaceScriptDetail = z.infer<typeof workspaceScriptDetailSchema>;
