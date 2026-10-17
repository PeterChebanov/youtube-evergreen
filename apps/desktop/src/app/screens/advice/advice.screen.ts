import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  TARGET_DURATION_DEFAULT,
  TARGET_DURATION_MAX,
  TARGET_DURATION_MIN,
  extractYoutubeVideoId,
} from '@youtube-ai-tool/shared';
import { HttpErrorResponse } from '@angular/common/http';
import { Api, errorText } from '../../core/api.service';
import type { AdviceLibraryItem, AdviceRunResult, Genre, ProjectDto } from '../../core/api.types';
import { PROJECT_SCREEN } from '../../core/project-nav';
import { Nav, ProjectStore } from '../../core/stores';
import type { LlmCatalog } from '../../core/api.types';
import { defaultVendorForStage, overridesForStage } from '../../core/llm-preferences';
import { Check } from '../../ui/check';
import { Dialogs } from '../../ui/dialog';
import { LlmVendorSelect } from '../../ui/llm-vendor-select';
import { PlanStore } from '../plan/plan.store';
import { AdviceStore } from './advice.store';
import { genreLabel, pipelineStages, sourceCell } from './advice.view';

const DEFAULT_PERIOD_INDEX = PERIOD_OPTIONS.findIndex((o) => JSON.stringify(o.value) === JSON.stringify(DEFAULT_PERIOD));

@Component({
  selector: 'section[esAdvice]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Check, LlmVendorSelect],
  host: { class: 'screen', id: 'screen-advice', 'data-screen': 'advice', '(document:click)': 'genreMenu.set(false)' },
  templateUrl: './advice.screen.html',
})
export class AdviceScreen {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  private readonly dialogs = inject(Dialogs);
  private readonly projects = inject(ProjectStore);
  private readonly plans = inject(PlanStore);
  readonly library = inject(AdviceStore);
  private readonly requestField = viewChild<ElementRef<HTMLTextAreaElement>>('requestField');
  private readonly getButton = viewChild<ElementRef<HTMLButtonElement>>('getButton');

  readonly periodOptions = PERIOD_OPTIONS;
  readonly periodIndex = signal(DEFAULT_PERIOD_INDEX);
  readonly genres = signal<Genre[]>([]);
  readonly genreIds = signal<string[]>([]);
  readonly genreMenu = signal(false);
  readonly skipMine = signal(true);
  readonly mode = signal<'advice' | 'custom'>('advice');

  readonly result = signal<AdviceRunResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selected = signal(0);
  readonly starting = signal<number | null>(null);

  readonly request = signal('');
  readonly refUrl = signal('');
  readonly useDatabase = signal(false);
  private readonly researchChoice = signal<boolean | null>(null);
  readonly researchChannel = computed(() => this.researchChoice() ?? !!this.refUrl().trim());
  readonly language = signal<'ru' | 'en'>('ru');
  readonly targetDurationMin = signal(TARGET_DURATION_DEFAULT);
  readonly durationBounds = { min: TARGET_DURATION_MIN, max: TARGET_DURATION_MAX };
  readonly requestError = signal<string | null>(null);
  readonly sending = signal(false);
  readonly catalog = signal<LlmCatalog | null>(null);
  readonly adviceVendor = signal<string | null>(null);

  readonly approvedGenres = computed(() => this.genres().filter((g) => g.status === 'approved'));
  readonly genreText = computed(() => genreLabel(this.genreIds(), new Map(this.genres().map((g) => [g.id, g.name]))));
  readonly rows = computed(() => (this.result()?.topics ?? []).map((topic, i) => ({ topic, i, source: sourceCell(topic) })));
  readonly savedRows = computed(() =>
    this.library.items().map((item) => ({ item, stages: pipelineStages(item.projectStatus) })),
  );
  readonly expandedAdvice = signal<Set<string>>(new Set());
  readonly expandedSuggested = signal<Set<number>>(new Set());

  constructor() {
    this.api.genres().then((g) => this.genres.set(g), () => this.genres.set([]));
    void this.api.llmCatalog().then((c) => {
      this.catalog.set(c);
      this.adviceVendor.set(defaultVendorForStage('advice', c));
    });
    void this.library.refresh();
  }

  focus(mode: 'advice' | 'custom') {
    this.mode.set(mode);
    (mode === 'custom' ? this.requestField() : this.getButton())?.nativeElement.focus();
  }

  toggleGenre(id: string) {
    this.genreIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  adviceExpanded(id: string) {
    return this.expandedAdvice().has(id);
  }

  toggleAdvice(id: string, event: Event) {
    event.stopPropagation();
    this.expandedAdvice.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  suggestedExpanded(index: number) {
    return this.expandedSuggested().has(index);
  }

  toggleSuggested(index: number, event: Event) {
    event.stopPropagation();
    this.expandedSuggested.update((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  setResearchChannel(value: boolean) {
    this.researchChoice.set(value);
  }

  async getTopics() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(
        await this.api.advice({
          period: PERIOD_OPTIONS[this.periodIndex()].value,
          genreIds: this.genreIds(),
          skipMyVideos: this.skipMine(),
          language: this.language(),
          targetDurationMin: this.clampDuration(this.targetDurationMin()),
          llmModelOverrides: overridesForStage('advice', this.adviceVendor()),
        }),
      );
      this.selected.set(0);
      await this.library.refresh();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  async makePlan(index: number) {
    const run = this.result();
    if (!run) return;
    await this.createProjectFromAdvice(run.runId, index);
  }

  async editTopic(runId: string, topicIndex: number, title: string) {
    const feedback = await this.dialogs.prompt({
      title: 'Edit topic',
      description: title.length > 200 ? `${title.slice(0, 197)}…` : title,
      placeholder: 'Add or remove themes, draft chapters, or change the angle…',
      confirmLabel: 'Refine topic',
    });
    if (!feedback?.trim()) return;
    this.error.set(null);
    try {
      const { topic } = await this.api.refineAdvice({
        runId,
        topicIndex,
        feedback: feedback.trim(),
        llmModelOverrides: overridesForStage('advice', this.adviceVendor()),
      });
      const run = this.result();
      if (run?.runId === runId) {
        this.result.set({ ...run, topics: run.topics.map((t, i) => (i === topicIndex ? topic : t)) });
      }
      await this.library.refresh();
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  async openSaved(item: AdviceLibraryItem) {
    if (item.projectId) {
      await this.enterExistingProject(item.projectId);
      return;
    }
    await this.createProjectFromAdvice(item.runId, item.topicIndex);
  }

  private async enterExistingProject(projectId: string) {
    this.error.set(null);
    try {
      await this.projects.reload(projectId);
      const p = this.projects.projects().find((x) => x.id === projectId);
      if (!p) throw new Error('Project not found');
      this.projects.select(p.id);
      void this.plans.load(p.id);
      this.nav.go(PROJECT_SCREEN[p.status] ?? 'plan');
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  /** Always asks the API to create (or 409 if this Advice row already has a project). */
  private async createProjectFromAdvice(runId: string, topicIndex: number) {
    this.starting.set(topicIndex);
    this.error.set(null);
    try {
      this.open(await this.api.projectFromAdvice(runId, topicIndex));
      await this.library.refresh();
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) {
        await this.library.refresh();
        const linked = this.library.items().find((i) => i.runId === runId && i.topicIndex === topicIndex)?.projectId;
        if (linked) {
          await this.enterExistingProject(linked);
          return;
        }
      }
      this.error.set(errorText(e));
    } finally {
      this.starting.set(null);
    }
  }

  async send() {
    const request = this.request().trim();
    const videoUrl = this.refUrl().trim();
    if (!request) return this.requestError.set('Describe the video you want.');
    if (videoUrl && !extractYoutubeVideoId(videoUrl)) return this.requestError.set('The reference must be a YouTube video URL.');
    this.requestError.set(null);
    this.sending.set(true);
    try {
      this.open(
        await this.api.projectFromRequest({
          request,
          videoUrl: videoUrl || undefined,
          researchChannelIntoDb: !!videoUrl && this.researchChannel(),
          useDatabase: this.useDatabase(),
          language: this.language(),
          targetDurationMin: this.clampDuration(this.targetDurationMin()),
        }),
      );
      this.request.set('');
      this.refUrl.set('');
      this.researchChoice.set(null);
    } catch (e) {
      this.requestError.set(errorText(e));
    } finally {
      this.sending.set(false);
    }
  }

  private clampDuration(n: number) {
    return Math.min(TARGET_DURATION_MAX, Math.max(TARGET_DURATION_MIN, Math.round(n) || TARGET_DURATION_DEFAULT));
  }

  private open(project: ProjectDto) {
    this.projects.upsert(project);
    this.projects.select(project.id);
    void this.plans.load(project.id);
    this.nav.go(PROJECT_SCREEN[project.status] ?? 'plan');
  }
}
