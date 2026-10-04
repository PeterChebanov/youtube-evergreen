import type { AdviceTopic } from '../../core/api.types';
import { formatCompact } from '../../core/format';

/** The Source column: what the topic is built on (DESIGN_SPEC 6.2). */
export function sourceCell(topic: AdviceTopic): { line: string; sub: string } {
  const src = topic.sources[0];
  if (!src) return { line: 'Library pattern', sub: '' };
  const sub = `${src.channelName} · ${Math.round(src.durationSec / 60)} min`;
  if (topic.type === 'rework') return { line: `${formatCompact(src.views)}-view video`, sub };
  const more = topic.sources.length > 1 ? ` +${topic.sources.length - 1}` : '';
  return { line: `Structure of a ${formatCompact(src.views)}-view video${more}`, sub };
}

export function genreLabel(selected: string[], names: Map<string, string>): string {
  if (!selected.length) return 'all';
  const shown = selected.slice(0, 2).map((id) => names.get(id) ?? id);
  return selected.length > 2 ? `${shown.join(', ')} +${selected.length - 2}` : shown.join(', ');
}
