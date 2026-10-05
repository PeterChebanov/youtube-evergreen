import { z } from 'zod';
import { LLM_STAGE_IDS } from './stages';
import { LLM_VENDOR_IDS } from './vendors';

const vendorOrRef = z
  .string()
  .trim()
  .min(1)
  .refine((v) => LLM_VENDOR_IDS.includes(v as (typeof LLM_VENDOR_IDS)[number]) || v.includes(':'), 'vendor id or provider:model');

const shape = Object.fromEntries(LLM_STAGE_IDS.map((id) => [id, vendorOrRef])) as Record<
  (typeof LLM_STAGE_IDS)[number],
  typeof vendorOrRef
>;

export const llmModelOverridesSchema = z.object(shape).partial();
