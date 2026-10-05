import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import type { DbColumn, DbRow, DbTable } from '../../core/api.types';
import { copyText } from '../../core/clipboard';
import { applyTableLayout, moveColumn, readTableLayout, saveTableLayout } from './database-layout';
import { pagesFor, tableWidth, visibleRange } from './database.view';

const PAGE = 200;
const ROW_H = 30;
const FILTER_DELAY_MS = 300;

type Selection = { row: number; column: string };

@Component({
  selector: 'section[esDatabase]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'screen', id: 'screen-database', 'data-screen': 'database' },
  templateUrl: './database.screen.html',
})
export class DatabaseScreen {
  private readonly api = inject(Api);
  private readonly viewport = viewChild<ElementRef<HTMLDivElement>>('viewport');

  readonly tables = signal<DbTable[]>([]);
  readonly table = signal('videos');
  readonly filter = signal('');
  readonly sort = signal<{ column: string; dir: 'asc' | 'desc' } | null>(null);
  readonly columns = signal<DbColumn[]>([]);
  readonly total = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly selection = signal<Selection | null>(null);
  private readonly pages = signal<Map<number, DbRow[]>>(new Map());
  private readonly scroll = signal({ top: 0, height: 600 });
  private readonly loading = new Set<number>();
  private generation = 0;
  private filterTimer: ReturnType<typeof setTimeout> | undefined;

  readonly layoutPrefs = signal<{ order: string[]; widths: Record<string, number> }>({ order: [], widths: {} });
  readonly dragCol = signal<number | null>(null);

  readonly views = computed(() => {
    const cols = this.columns();
    if (!cols.length) return [];
    const prefs = this.layoutPrefs();
    return applyTableLayout(cols, {
      order: prefs.order.length ? prefs.order : undefined,
      widths: prefs.widths,
    });
  });
  readonly width = computed(() => tableWidth(this.views()));
  readonly range = computed(() => visibleRange(this.scroll().top, this.scroll().height, ROW_H, this.total() ?? 0));
  readonly rows = computed(() => {
    const { start, end } = this.range();
    const pages = this.pages();
    const out: Array<{ index: number; row: DbRow | null }> = [];
    for (let i = start; i < end; i++) out.push({ index: i, row: pages.get(Math.floor(i / PAGE))?.[i % PAGE] ?? null });
    return out;
  });
  readonly padTop = computed(() => this.range().start * ROW_H);
  readonly padBottom = computed(() => Math.max(0, ((this.total() ?? 0) - this.range().end) * ROW_H));
  readonly countLabel = computed(() => (this.total() === null ? 'loading' : `${this.total()!.toLocaleString('en-US')} rows · read-only`));
  readonly selectedValue = computed(() => {
    const s = this.selection();
    if (!s) return null;
    return this.pages().get(Math.floor(s.row / PAGE))?.[s.row % PAGE]?.[s.column] ?? null;
  });
  readonly selectedRef = computed(() => {
    const s = this.selection();
    if (!s) return 'nothing selected';
    const row = this.pages().get(Math.floor(s.row / PAGE))?.[s.row % PAGE];
    return `selected: ${row?.['id'] ?? `row ${s.row + 1}`}.${s.column}`;
  });

  constructor() {
    this.api.dbTables().then((t) => this.tables.set(t), (e) => this.error.set(errorText(e)));
    this.loadLayout(this.table());
    void this.reset();
  }

  selectTable(name: string) {
    this.table.set(name);
    this.sort.set(null);
    this.loadLayout(name);
    void this.reset();
  }

  private loadLayout(table: string) {
    const saved = readTableLayout(table);
    this.layoutPrefs.set({ order: saved?.order ?? [], widths: saved?.widths ?? {} });
  }

  dragStart(index: number, event: DragEvent) {
    event.dataTransfer?.setData('text/plain', String(index));
    event.dataTransfer!.effectAllowed = 'move';
    this.dragCol.set(index);
  }

  dragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  dropColumn(toIndex: number, event: DragEvent) {
    event.preventDefault();
    const from = Number(event.dataTransfer?.getData('text/plain'));
    if (!Number.isFinite(from)) return;
    const order = this.views().map((v) => v.name);
    this.persistLayout({ order: moveColumn(order, from, toIndex) });
    this.dragCol.set(null);
  }

  dragEnd() {
    this.dragCol.set(null);
  }

  startResize(column: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const th = (event.target as HTMLElement).closest('th');
    const startX = event.clientX;
    const startW = th?.offsetWidth ?? this.views().find((v) => v.name === column)?.width ?? 200;
    const move = (ev: MouseEvent) => {
      const w = Math.max(48, startW + ev.clientX - startX);
      this.layoutPrefs.update((p) => ({ ...p, widths: { ...p.widths, [column]: w } }));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      this.persistLayout({});
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  private persistLayout(partial: { order?: string[] }) {
    const table = this.table();
    const prev = this.layoutPrefs();
    const next = { order: partial.order ?? prev.order, widths: { ...prev.widths } };
    this.layoutPrefs.set(next);
    saveTableLayout(table, { order: next.order.length ? next.order : undefined, widths: next.widths });
  }

  setFilter(value: string) {
    this.filter.set(value);
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => void this.reset(), FILTER_DELAY_MS);
  }

  toggleSort(column: string) {
    const s = this.sort();
    this.sort.set(s?.column === column ? (s.dir === 'asc' ? { column, dir: 'desc' } : null) : { column, dir: 'asc' });
    void this.reset();
  }

  sortMark(column: string): string {
    const s = this.sort();
    return s?.column === column ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '';
  }

  onScroll(el: HTMLElement) {
    this.scroll.set({ top: el.scrollTop, height: el.clientHeight });
    void this.ensurePages();
  }

  select(row: number, column: string) {
    this.selection.set({ row, column });
  }

  async copyCell() {
    const v = this.selectedValue();
    if (this.selection()) {
      await copyText(v ?? '');
      this.notice.set('Cell copied.');
    }
  }

  async copyTable() {
    try {
      await copyText(await this.api.dbExport(this.table(), this.query()));
      this.notice.set(`Copied ${this.table()} as tab-separated rows with a header line.`);
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  private query() {
    const s = this.sort();
    return { q: this.filter().trim() || undefined, sort: s?.column, dir: s?.dir };
  }

  private async reset() {
    const gen = ++this.generation;
    this.loading.clear();
    this.pages.set(new Map());
    this.selection.set(null);
    this.notice.set(null);
    const el = this.viewport()?.nativeElement;
    if (el) el.scrollTop = 0;
    this.scroll.update((s) => ({ ...s, top: 0 }));
    await this.loadPage(0, gen);
  }

  private async ensurePages() {
    const { start, end } = this.range();
    for (const p of pagesFor(start, end, PAGE)) if (!this.pages().has(p)) await this.loadPage(p, this.generation);
  }

  private async loadPage(page: number, gen: number) {
    if (this.loading.has(page)) return;
    this.loading.add(page);
    try {
      const res = await this.api.dbRows(this.table(), { ...this.query(), limit: PAGE, offset: page * PAGE });
      if (gen !== this.generation) return;
      this.columns.set(res.columns);
      this.total.set(res.total);
      this.error.set(null);
      this.pages.update((m) => new Map(m).set(page, res.rows));
      const el = this.viewport()?.nativeElement;
      if (el) this.scroll.set({ top: el.scrollTop, height: el.clientHeight });
    } catch (e) {
      if (gen === this.generation) this.error.set(errorText(e));
    } finally {
      this.loading.delete(page);
    }
  }
}
