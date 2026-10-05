import type { DbColumn } from '../../core/api.types';
import { type ColumnView, columnViews } from './database.view';

const STORAGE_KEY = 'es-db-table-layout';

export type TableLayoutPrefs = { order?: string[]; widths?: Record<string, number> };
type Store = Record<string, TableLayoutPrefs>;

function readStore(): Store {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readTableLayout(table: string): TableLayoutPrefs | null {
  const row = readStore()[table];
  return row && (row.order?.length || row.widths && Object.keys(row.widths).length) ? row : null;
}

export function saveTableLayout(table: string, prefs: TableLayoutPrefs) {
  const store = readStore();
  store[table] = { ...store[table], ...prefs };
  writeStore(store);
}

/** Default sizing + saved order/widths for this table. */
export function applyTableLayout(columns: DbColumn[], prefs: TableLayoutPrefs | null): ColumnView[] {
  const defaults = columnViews(columns);
  const byName = new Map(defaults.map((v) => [v.name, v]));
  let order = prefs?.order?.filter((n) => byName.has(n)) ?? defaults.map((v) => v.name);
  for (const v of defaults) {
    if (!order.includes(v.name)) order.push(v.name);
  }
  return order.map((name) => {
    const base = byName.get(name)!;
    const w = prefs?.widths?.[name];
    if (w != null && w >= 48) return { ...base, width: Math.round(w) };
    return base;
  });
}

export function moveColumn(order: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
