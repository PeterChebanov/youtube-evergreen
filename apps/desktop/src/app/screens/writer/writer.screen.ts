import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import type { FactDto, WriterState } from '../../core/api.types';
import { fileSlug, saveText } from '../../core/download';
import { paragraphs, shortUrl } from '../../core/format';
import { Nav, ProjectStore } from '../../core/stores';
import { chapterFacts } from '../facts/facts.view';
import { ProjectAiSettings } from '../../ui/project-ai-settings';
import { ProjectTag } from '../../ui/project-tag';
import { WorkspaceLibrary } from '../../ui/workspace-library';
import { WriterFullTextDialog } from './writer-full-text.dialog';
import { chapterLabel, focusChapter, nextStep } from './writer.view';

const WRITER_STATUSES = ['research_approved', 'writing', 'done'];

@Component({
  selector: 'section[esWriter]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectAiSettings, ProjectTag, WorkspaceLibrary, WriterFullTextDialog],
  host: { class: 'screen', id: 'screen-writer', 'data-screen': 'writer' },
  templateUrl: './writer.screen.html',
})
export class WriterScreen {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  readonly projects = inject(ProjectStore);

  readonly state = signal<WriterState | null>(null);
  readonly facts = signal<FactDto[]>([]);
  readonly selectedOrder = signal<number | null>(null);
  readonly writingOrder = signal<number | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedback = signal('');
  readonly editing = signal(false);
  readonly draftText = signal('');
  readonly shortUrl = shortUrl;
  readonly chapterLabel = chapterLabel;

  readonly project = this.projects.current;
  readonly ready = computed(() => WRITER_STATUSES.includes(this.project()?.status ?? ''));
  readonly done = computed(() => this.project()?.status === 'done');
  readonly current = computed(() => {
    const s = this.state();
    if (!s) return null;
    return s.chapters.find((c) => c.chapterOrder === this.selectedOrder()) ?? focusChapter(s);
  });
  readonly step = computed(() => (this.state() ? nextStep(this.state()!, this.current()) : null));
  readonly paragraphs = computed(() => paragraphs(this.current()?.text ?? ''));
  readonly chapterFacts = computed(() => (this.current() ? chapterFacts(this.facts(), this.current()!.chapterOrder) : []));
  readonly language = computed(() => (this.project()?.language ?? 'ru').toUpperCase());
  readonly hasScriptText = computed(() => this.state()?.chapters.some((c) => c.text.trim()) ?? false);
  readonly fullTextOpen = signal(false);

  constructor() {
    let projectId: string | undefined;
    effect(() => {
      const p = this.project();
      untracked(() => {
        if (p?.id !== projectId) {
          projectId = p?.id;
          this.state.set(null);
          this.selectedOrder.set(null);
          this.editing.set(false);
          if (p && this.ready()) void this.loadFacts(p.id);
        }
        if (p && this.ready()) void this.load();
      });
    });
  }

  async load() {
    const p = this.project();
    if (!p) return;
    try {
      this.state.set(await this.api.script(p.id));
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  private async loadFacts(projectId: string) {
    try {
      this.facts.set((await this.api.facts(projectId)).facts);
    } catch {
      this.facts.set([]);
    }
  }

  select(order: number) {
    this.selectedOrder.set(order);
    this.editing.set(false);
  }

  async next() {
    const step = this.step();
    const id = this.project()?.id;
    if (!step || !id || step.kind === 'none') return;
    await this.act(async () => {
      if (step.kind === 'approve' || step.kind === 'approve-and-write') await this.api.approveChapter(id, step.order);
      const target = step.kind === 'approve-and-write' ? step.next : step.kind === 'write' ? step.order : null;
      if (target !== null) {
        this.selectedOrder.set(target);
        this.writingOrder.set(target);
        await this.api.writeChapter(id, target);
      }
    });
  }

  async refine() {
    const c = this.current();
    const text = this.feedback().trim();
    if (!c || !text) return;
    await this.act(async () => {
      this.writingOrder.set(c.chapterOrder);
      await this.api.refineChapter(this.project()!.id, c.chapterOrder, text);
      this.feedback.set('');
    });
  }

  startEdit() {
    this.draftText.set(this.current()?.text ?? '');
    this.editing.set(true);
  }

  async saveEdit() {
    const c = this.current();
    if (!c) return;
    await this.act(async () => {
      await this.api.saveChapter(this.project()!.id, c.chapterOrder, this.draftText());
      this.editing.set(false);
    });
  }

  async exportMarkdown() {
    const p = this.project();
    if (!p) return;
    await this.act(async () => saveText(`${fileSlug(p.title)}.md`, await this.api.exportScript(p.id)), false);
  }

  openFullText() {
    if (!this.project() || !this.hasScriptText()) return;
    this.fullTextOpen.set(true);
  }

  closeFullText() {
    this.fullTextOpen.set(false);
  }

  async onFullTextSaved() {
    await this.load();
  }

  async finalize() {
    const p = this.project();
    if (!p) return;
    await this.act(async () => {
      await this.api.finalizeScript(p.id);
      await this.projects.reload(p.id);
      this.nav.go('videos');
    });
  }

  private async act(action: () => Promise<unknown>, reload = true) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.writingOrder.set(null);
      this.busy.set(false);
      if (reload) {
        await this.load();
        const p = this.project();
        if (p && p.status === 'research_approved') await this.projects.reload(p.id).catch(() => undefined);
      }
    }
  }
}
