import { formatModelRef } from './model-ref';
import { isLlmVendorId, type LlmVendorId } from './vendors';

export type LlmVendorEnvConfig = Record<
  LlmVendorId,
  { apiKey: string; model: string }
>;

export function vendorModelRefFromEnv(cfg: LlmVendorEnvConfig, vendor: LlmVendorId): string | null {
  const row = cfg[vendor];
  if (!row?.apiKey?.trim() || !row.model?.trim()) return null;
  return formatModelRef(vendor, row.model.trim());
}

export function expandVendorSelection(cfg: LlmVendorEnvConfig, selection: string): string | null {
  const raw = selection.trim();
  if (!raw) return null;
  if (isLlmVendorId(raw)) return vendorModelRefFromEnv(cfg, raw);
  if (raw.includes(':')) return raw;
  return null;
}
