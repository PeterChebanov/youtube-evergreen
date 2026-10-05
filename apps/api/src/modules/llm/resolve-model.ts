import {
  DEFAULT_STAGE_BY_PROMPT,
  expandVendorSelection,
  vendorModelRefFromEnv,
  type LlmStageId,
  type LlmVendorEnvConfig,
  type LlmVendorId,
} from '@youtube-ai-tool/shared';
import type { AppConfig } from '../../config/app.config';
import type { PromptName } from './prompt-names';

export type LlmCallContext = {
  stageId?: LlmStageId;
  modelSelection?: string;
  runOverrides?: Partial<Record<LlmStageId, string>>;
  projectOverrides?: Partial<Record<LlmStageId, string>>;
};

function vendorCfg(llm: AppConfig['llm']): LlmVendorEnvConfig {
  const p = llm.providers;
  return {
    openai: { apiKey: p.openai.apiKey, model: p.openai.model },
    anthropic: { apiKey: p.anthropic.apiKey, model: p.anthropic.model },
    gemini: { apiKey: p.gemini.apiKey, model: p.gemini.model },
    xai: { apiKey: p.xai.apiKey, model: p.xai.model },
    perplexity: { apiKey: p.perplexity.apiKey, model: p.perplexity.model },
  };
}

export function vendorModelRef(cfg: AppConfig['llm'], vendor: LlmVendorId): string | null {
  return vendorModelRefFromEnv(vendorCfg(cfg), vendor);
}

export function expandModelSelection(cfg: AppConfig['llm'], selection: string): string {
  const raw = selection.trim();
  const expanded = expandVendorSelection(vendorCfg(cfg), raw);
  if (expanded) return expanded;
  if (raw.includes(':')) return raw;
  throw new Error(`Unknown LLM selection "${raw}"`);
}

export function resolveModelRef(cfg: AppConfig['llm'], promptName: PromptName, ctx: LlmCallContext = {}): string {
  const stageId = ctx.stageId ?? DEFAULT_STAGE_BY_PROMPT[promptName as keyof typeof DEFAULT_STAGE_BY_PROMPT];

  if (ctx.modelSelection?.trim()) return expandModelSelection(cfg, ctx.modelSelection);
  if (stageId && ctx.runOverrides?.[stageId]) return expandModelSelection(cfg, ctx.runOverrides[stageId]!);
  if (stageId && ctx.projectOverrides?.[stageId]) return expandModelSelection(cfg, ctx.projectOverrides[stageId]!);

  if (stageId && cfg.stageDefaults[stageId]) return cfg.stageDefaults[stageId];
  return cfg.models[promptName];
}

export function listConfiguredVendors(cfg: AppConfig['llm']) {
  const labels: Record<LlmVendorId, string> = {
    openai: 'GPT',
    anthropic: 'Claude',
    gemini: 'Gemini',
    xai: 'Grok',
    perplexity: 'Perplexity',
  };
  return (['openai', 'anthropic', 'gemini', 'xai', 'perplexity'] as const).map((id) => ({
    id,
    label: labels[id],
    modelRef: vendorModelRef(cfg, id),
    configured: Boolean(vendorModelRef(cfg, id)),
  }));
}

export function resolveEmbeddingModel(cfg: AppConfig['llm']): string {
  if (cfg.providers.openai.apiKey) return cfg.embeddingModel;
  throw new Error('OPENAI_API_KEY is required for embeddings (Advice dedup, video vectors)');
}
