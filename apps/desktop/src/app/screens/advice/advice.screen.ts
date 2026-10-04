import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, extractYoutubeVideoId } from '@youtube-ai-tool/shared';
import { Api, errorText } from '../../core/api.service';
import type { AdviceRunResult, Genre, ProjectDto } from '../../core/api.types';
import { Nav, ProjectStore } from '../../core/stores';
import { Check } from '../../ui/check';
import { PlanStore } from '../plan/plan.store';
import { genreLabel, sourceCell } from './advice.view';

const DEFAULT_PERIOD_INDEX = PERIOD_OPTIONS.findIndex((o) => JSON.stringify(o.value) === JSON.stringify(DEFAULT_PERIOD));

@Component({
  selector: 'section[esAdvice]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Check],
  host: { class: 'screen', id: 'screen-advice', 'data-screen': 'advice', '(document:click)': 'genreMenu.set(false)' },
  templateUrl: './advice.screen.html',
})
export class AdviceScreen {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  private readonly projects = inject(ProjectStore);
  private readonly plans = inject(PlanStore);
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
  readonly requestError = signal<string | null>(null);
  readonly sending = signal(false);

  readonly approvedGenres = computed(() => this.genres().filter((g) => g.status === 'approved'));
  readonly genreText = computed(() => genreLabel(this.genreIds(), new Map(this.genres().map((g) => [g.id, g.name]))));
  readonly rows = computed(() => (this.result()?.topics ?? []).map((topic, i) => ({ topic, i, source: sourceCell(topic) })));

  constructor() {
    this.api.genres().then((g) => this.genres.set(g), () => this.genres.set([]));
  }

  focus(mode: 'advice' | 'custom') {
    this.mode.set(mode);
    (mode === 'custom' ? this.requestField() : this.getButton())?.nativeElement.focus();
  }

  toggleGenre(id: string) {
    this.genreIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
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
        }),
      );
      this.selected.set(0);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  async makePlan(index: number) {
    const run = this.result();
    if (!run) return;
    this.starting.set(index);
    try {
      this.open(await this.api.projectFromAdvice(run.runId, index));
    } catch (e) {
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

  private open(project: ProjectDto) {
    this.projects.upsert(project);
    this.projects.select(project.id);
    void this.plans.generate(project.id);
    this.nav.go('plan');
  }
}
