import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { canEditFacts } from '@youtube-ai-tool/shared';
import { Api, errorText } from '../../core/api.service';
import type { FactResearchState } from '../../core/api.types';
import { JOB_POLL_MS } from '../../core/config';
import { shortUrl } from '../../core/format';
import { Nav, ProjectStore, poll } from '../../core/stores';
import { Dialogs } from '../../ui/dialog';
import { ProjectAiSettings } from '../../ui/project-ai-settings';
import { ProjectTag } from '../../ui/project-tag';
import { WorkspaceLibrary } from '../../ui/workspace-library';
import { chapterFacts, isHttpUrl, sourcesMeta } from './facts.view';

const ACTIVE = ['queued', 'running'];

@Component({
  selector: 'section[esFacts]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectAiSettings, ProjectTag, WorkspaceLibrary],
  host: { class: 'screen', id: 'screen-facts', 'data-screen': 'facts' },
  templateUrl: './facts.screen.html',
})
export class FactsScreen {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  private readonly dialogs = inject(Dialogs);
  readonly projects = inject(ProjectStore);

  readonly state = signal<FactResearchState | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly selectedOrder = signal<number | null>(null);
  readonly newText = signal('');
  readonly newUrl = signal('');
  readonly addError = signal<string | null>(null);
  readonly working = signal(false);
  readonly shortUrl = shortUrl;

  readonly project = this.projects.current;
  readonly started = computed(() => !['draft', 'planning'].includes(this.project()?.status ?? 'draft'));
  readonly editable = computed(() => canEditFacts(this.project()?.status ?? 'draft'));
  readonly canHandToWriter = computed(() => this.project()?.status === 'researching');
  readonly running = computed(() => ACTIVE.includes(this.state()?.status ?? ''));
  readonly chapters = computed(() => this.state()?.chapters ?? []);
  readonly current = computed(() => this.chapters().find((c) => c.order === this.selectedOrder()) ?? this.chapters().at(0) ?? null);
  readonly rows = computed(() => (this.current() ? chapterFacts(this.state()?.facts ?? [], this.current()!.order) : []));
  readonly meta = computed(() => sourcesMeta(this.rows()));
  readonly doneCount = computed(() => this.chapters().filter((c) => c.state === 'done').length);

  constructor() {
    let projectId: string | undefined;
    effect(() => {
      const p = this.project();
      untracked(() => {
        if (p?.id !== projectId) {
          projectId = p?.id;
          this.selectedOrder.set(null);
          this.state.set(null);
        }
        void this.load();
      });
    });
    poll(inject(DestroyRef), JOB_POLL_MS, () => (this.running() ? this.load() : undefined));
  }

  async load() {
    const p = this.project();
    if (!p || !this.started()) return;
    try {
      this.state.set(await this.api.facts(p.id));
      this.loadError.set(null);
    } catch (e) {
      this.loadError.set(errorText(e));
    }
  }

  retryBatch() {
    return this.act(() => this.api.retryFactsBatch(this.project()!.id));
  }

  async retryOneFact(factId: string, factText: string) {
    const notes = await this.dialogs.prompt({
      title: 'Retry this fact',
      description: factText.length > 280 ? `${factText.slice(0, 277)}…` : factText,
      placeholder: 'Optional: e.g. find a 2026 source, AI angle…',
      confirmLabel: 'Retry fact',
      allowEmpty: true,
    });
    if (notes === null) return;
    await this.act(() => this.api.retryFact(this.project()!.id, factId, notes));
  }

  async editOneFact(factId: string, factText: string) {
    const feedback = await this.dialogs.prompt({
      title: 'Edit this fact',
      description: factText.length > 280 ? `${factText.slice(0, 277)}…` : factText,
      placeholder: 'What to add, remove, or change…',
      confirmLabel: 'Edit fact',
    });
    if (!feedback?.trim()) return;
    await this.act(() => this.api.refineFact(this.project()!.id, factId, feedback.trim()));
  }

  searchAgain(order: number) {
    return this.act(() => this.api.refineFacts(this.project()!.id, 'Search again with different queries and sources', order));
  }

  retry() {
    return this.act(() => this.api.retryFacts(this.project()!.id));
  }

  async addFact() {
    const text = this.newText().trim();
    const url = this.newUrl().trim();
    if (!text) return this.addError.set('Write the fact.');
    if (!isHttpUrl(url)) return this.addError.set('A fact needs the URL of its source.');
    this.addError.set(null);
    await this.act(() => this.api.addFact(this.project()!.id, { planChapterOrder: this.current()!.order, text, sourceUrl: url }));
    this.newText.set('');
    this.newUrl.set('');
  }

  removeFact(id: string) {
    return this.act(() => this.api.deleteFact(this.project()!.id, id));
  }

  async approve() {
    const p = this.project();
    if (!p) return;
    this.working.set(true);
    try {
      await this.api.approveFacts(p.id);
      await this.projects.reload(p.id);
      this.nav.go('writer');
    } catch (e) {
      this.actionError.set(errorText(e));
    } finally {
      this.working.set(false);
    }
  }

  private async act(action: () => Promise<unknown>) {
    this.actionError.set(null);
    this.working.set(true);
    try {
      await action();
      await this.load();
    } catch (e) {
      this.actionError.set(errorText(e));
    } finally {
      this.working.set(false);
    }
  }
}
