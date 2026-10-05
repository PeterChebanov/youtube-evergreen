import type { LlmProviderId } from './model-ref';

/** Fixed LLM vendors selectable in UI (one model per vendor from .env). */
export const LLM_VENDOR_IDS = ['openai', 'anthropic', 'gemini', 'xai', 'perplexity'] as const;
export type LlmVendorId = (typeof LLM_VENDOR_IDS)[number];

export const LLM_VENDOR_LABELS: Record<LlmVendorId, string> = {
  openai: 'GPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  xai: 'Grok',
  perplexity: 'Perplexity',
};

export function isLlmVendorId(value: string): value is LlmVendorId {
  return (LLM_VENDOR_IDS as readonly string[]).includes(value);
}

/** Vendor id or `provider:model` ref → provider id. */
export function vendorFromSelection(selection: string): LlmProviderId | null {
  const s = selection.trim();
  if (!s) return null;
  if (isLlmVendorId(s)) return s;
  const i = s.indexOf(':');
  if (i > 0 && isLlmVendorId(s.slice(0, i))) return s.slice(0, i) as LlmProviderId;
  return null;
}
