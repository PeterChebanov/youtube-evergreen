import { z } from 'zod';
import { PROJECT_LLM_STAGE_IDS } from './stages';

const shape = Object.fromEntries(PROJECT_LLM_STAGE_IDS.map((id) => [id, z.string()])) as Record<
  (typeof PROJECT_LLM_STAGE_IDS)[number],
  z.ZodString
>;

export const llmModelOverridesSchema = z.object(shape).partial();
