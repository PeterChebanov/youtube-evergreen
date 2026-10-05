import type { DbColumn, DbRow } from '../../core/api.types';

export type ColumnView = { name: string; width: number | null; right: boolean; mono: boolean };

const NUMERIC = ['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'];
const TIME = ['timestamp without time zone', 'timestamp with time zone', 'date'];
const WIDE_TEXT = ['title', 'description', 'name', 'channel_name', 'channel_handle', 'text', 'topic'];
const UNSIZED_MIN = 240;
export const TABLE_MIN = 960;

/** Fixed widths per stored type; one long text column takes the rest (DESIGN_SPEC 5.2). */
export function columnViews(columns: DbColumn[]): ColumnView[] {
  const flexible = columns.find((c) => WIDE_TEXT.includes(c.name))?.name ?? null;
  return columns.map((c) => {
    if (c.name === flexible) return { name: c.name, width: null, right: false, mono: false };
    if (c.name === 'id' || c.name.endsWith('_id')) return { name: c.name, width: 130, right: false, mono: true };
    if (NUMERIC.includes(c.type)) return { name: c.name, width: 110, right: true, mono: true };
    if (TIME.includes(c.type)) return { name: c.name, width: 176, right: false, mono: true };
    if (c.type === 'boolean') return { name: c.name, width: 80, right: false, mono: true };
    if (c.type === 'vector') return { name: c.name, width: 120, right: false, mono: true };
    if (c.type === 'json' || c.type === 'jsonb' || c.type === 'ARRAY') return { name: c.name, width: 240, right: false, mono: true };
    return { name: c.name, width: 200, right: false, mono: false };
  });
}

export function tableWidth(views: ColumnView[]): number {
  return Math.max(TABLE_MIN, views.reduce((sum, v) => sum + (v.width ?? UNSIZED_MIN), 0));
}

/** Rows to render for the current scroll position, with an overscan on both sides. */
export function visibleRange(scrollTop: number, viewportHeight: number, rowHeight: number, total: number, overscan = 12) {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(total, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start: first, end: Math.max(first, last) };
}

export function pagesFor(start: number, end: number, pageSize: number): number[] {
  if (end <= start) return [];
  const pages: number[] = [];
  for (let p = Math.floor(start / pageSize); p <= Math.floor((end - 1) / pageSize); p++) pages.push(p);
  return pages;
}

export function toTsv(columns: string[], rows: DbRow[]): string {
  const cell = (v: string | null | undefined) => (v ?? '').replace(/[\t\r\n]+/g, ' ');
  return [columns.join('\t'), ...rows.map((r) => columns.map((c) => cell(r[c])).join('\t'))].join('\n');
}
