import type { TranscriptAnalysis } from '@youtube-ai-tool/shared';

export type PromptLayer = { label: string; body: string | null | undefined };

export type ChannelVoice = {
  voice: string;
  themes: string;
  techniques: Array<{ name: string; description: string }>;
  retentionRules: string;
};

export type AuthorOverlay = {
  channelName: string;
  techniques: Array<{ technique: string; description: string }>;
};

export type LayerSources = {
  base: string[];
  retentionBase?: string;
  channelStyle?: ChannelVoice | null;
  genreModule?: string | null;
  overlay?: AuthorOverlay | null;
  toneReferences?: TranscriptAnalysis[];
  dbPriority?: string | null;
};

export const OVERLAY_GUARD =
  'These techniques are additive: the retention base and the channel voice above always prevail. Borrow individual moves, never imitate this author wholesale.';

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

function retentionLayer(base: string | undefined, style: ChannelVoice | null | undefined): string | null {
  const parts = [base, style?.retentionRules && `Channel retention rules:\n${style.retentionRules}`].filter(Boolean);
  return parts.length ? parts.join('\n\n') : null;
}

function channelLayer(style: ChannelVoice | null | undefined): string | null {
  if (!style) return null;
  return [
    `Voice: ${style.voice}`,
    `Themes: ${style.themes}`,
    style.techniques.length ? `Techniques:\n${bullets(style.techniques.map((t) => `${t.name}: ${t.description}`))}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function overlayLayer(overlay: AuthorOverlay | null | undefined): string | null {
  if (!overlay?.techniques.length) return null;
  return `${OVERLAY_GUARD}\n\nTechniques of ${overlay.channelName}:\n${bullets(
    overlay.techniques.map((t) => `${t.technique}: ${t.description}`),
  )}`;
}

function toneLayer(refs: TranscriptAnalysis[] | undefined): string | null {
  if (!refs?.length) return null;
  return refs
    .map(
      (r, i) =>
        `Reference ${i + 1}: tone ${r.tone}; pace ${r.pace}; address ${r.address}; humor ${r.humor}; delivery ${r.delivery}. ` +
        `Typical phrases: ${r.phrases.join(' / ')}`,
    )
    .join('\n');
}

/** Layer order from PROMPTS.md §3; later layers supplement earlier ones. */
export function buildLayers(src: LayerSources): PromptLayer[] {
  return [
    ...src.base.map((body, i) => ({ label: i === 0 ? 'Task' : 'Task details', body })),
    { label: 'Retention base', body: retentionLayer(src.retentionBase, src.channelStyle) },
    { label: 'Channel voice', body: channelLayer(src.channelStyle) },
    { label: 'Genre tilt (a direction, not a limit)', body: src.genreModule },
    { label: 'Stylistic overlay', body: overlayLayer(src.overlay) },
    { label: 'Tone references', body: toneLayer(src.toneReferences) },
    { label: 'Database', body: src.dbPriority },
  ];
}

export function renderLayers(layers: PromptLayer[]): string {
  return layers
    .filter((l) => l.body?.trim())
    .map((l) => `## ${l.label}\n\n${l.body!.trim()}`)
    .join('\n\n');
}
