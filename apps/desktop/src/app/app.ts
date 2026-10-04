import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { formatInt, formatUsd } from './core/format';
import { TABS, createChordReader, isTypingTarget } from './core/screens';
import { Nav, ProjectStore, StatusStore } from './core/stores';
import { AdviceScreen } from './screens/advice/advice.screen';
import { DatabaseScreen } from './screens/database/database.screen';
import { FactsScreen } from './screens/facts/facts.screen';
import { PlanScreen } from './screens/plan/plan.screen';
import { ResearchScreen } from './screens/research/research.screen';
import { StyleScreen } from './screens/style/style.screen';
import { SubtitlesScreen } from './screens/subtitles/subtitles.screen';
import { VideosScreen } from './screens/videos/videos.screen';
import { WriterScreen } from './screens/writer/writer.screen';
import { Palette } from './shell/palette';
import { ProjectMenu } from './shell/project-menu';
import { DialogHost } from './ui/dialog';

@Component({
  selector: 'es-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdviceScreen,
    DatabaseScreen,
    DialogHost,
    FactsScreen,
    Palette,
    PlanScreen,
    ProjectMenu,
    ResearchScreen,
    StyleScreen,
    SubtitlesScreen,
    VideosScreen,
    WriterScreen,
  ],
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './app.html',
})
export class App {
  readonly nav = inject(Nav);
  readonly status = inject(StatusStore);
  private readonly projects = inject(ProjectStore);
  readonly tabs = TABS;
  readonly palette = signal(false);
  private readonly chord = createChordReader();

  readonly queues = computed(() => {
    const q = this.status.status()?.queues;
    return q ? `BullMQ: ${q.running} running · ${q.queued} queued` : 'BullMQ: –';
  });
  readonly quota = computed(() => {
    const q = this.status.status()?.youtubeQuota;
    return q ? `YouTube quota ${formatInt(q.used)} / ${formatInt(q.limit)}` : 'YouTube quota –';
  });
  readonly spend = computed(() => `LLM spend today ${formatUsd(this.status.status()?.llmSpendTodayUsd ?? 0)}`);
  readonly videos = computed(() => `Postgres: ${formatInt(this.status.status()?.videoCount ?? 0)} videos`);

  constructor() {
    this.status.start(inject(DestroyRef));
    void this.projects.refresh();
  }

  onKey(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.update((v) => !v);
      return;
    }
    if (event.key === 'Escape') this.palette.set(false);
    if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target) || this.palette()) return;
    const target = this.chord(event.key);
    if (target) this.nav.go(target);
  }
}
