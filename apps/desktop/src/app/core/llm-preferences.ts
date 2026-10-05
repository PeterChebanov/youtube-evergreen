import {
  CHANNEL_RESEARCH_STAGE_IDS,
  type LlmStageId,
  vendorOverridesForStages,
} from '@youtube-ai-tool/shared';

const KEY = 'es-llm-stage-vendors';

function readAll(): Partial<Record<LlmStageId, string>> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<LlmStageId, string>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) out[k as LlmStageId] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(next: Partial<Record<LlmStageId, string>>) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function readStageVendor(stage: LlmStageId): string | null {
  return readAll()[stage] ?? null;
}

export function writeStageVendor(stage: LlmStageId, vendor: string | null) {
  const all = readAll();
  if (vendor?.trim()) all[stage] = vendor.trim();
  else delete all[stage];
  writeAll(all);
}

export function overridesForStage(stage: LlmStageId, vendor: string | null): Partial<Record<LlmStageId, string>> {
  if (!vendor?.trim()) return {};
  return { [stage]: vendor.trim() };
}

export function channelResearchOverrides(vendor: string | null): Partial<Record<LlmStageId, string>> {
  if (!vendor?.trim()) return {};
  return vendorOverridesForStages(vendor.trim(), CHANNEL_RESEARCH_STAGE_IDS);
}

/** Last chosen vendor for a stage, or first configured vendor from catalog. */
export function defaultVendorForStage(
  stage: LlmStageId,
  catalog: { vendors: Array<{ id: string; configured: boolean }> } | null,
): string | null {
  const saved = readStageVendor(stage);
  if (saved && catalog?.vendors.some((v) => v.id === saved && v.configured)) return saved;
  return catalog?.vendors.find((v) => v.configured)?.id ?? null;
}
