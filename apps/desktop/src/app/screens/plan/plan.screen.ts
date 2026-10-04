import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import { minutesClock } from '../../core/format';
import { Nav, ProjectStore } from '../../core/stores';
import { PlanStore } from './plan.store';
import { chapterChips, planSubtitle, riddleMarkers } from './plan.view';

@Component({
  selector: 'section[esPlan]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'screen', id: 'screen-plan', 'data-screen': 'plan' },
  templateUrl: './plan.screen.html',
})
export class PlanScreen {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  private readonly plans = inject(PlanStore);
  readonly projects = inject(ProjectStore);

  readonly feedback = signal('');
  readonly lastFeedback = signal('');
  readonly versionIndex = signal(0);
  readonly approving = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly project = this.projects.current;
  readonly state = computed(() => {
    const p = this.project();
    return p ? this.plans.state(p.id) : null;
  });
  readonly versions = computed(() => this.state()?.versions ?? null);
  readonly version = computed(() => this.versions()?.[Math.min(this.versionIndex(), (this.versions()?.length ?? 1) - 1)] ?? null);
  readonly plan = computed(() => this.version()?.content ?? null);
  readonly editable = computed(() => ['draft', 'planning'].includes(this.project()?.status ?? ''));
  readonly busy = computed(() => this.state()?.busy ?? null);
  readonly markers = computed(() => (this.plan() ? riddleMarkers(this.plan()!) : []));
  readonly subtitle = computed(() => (this.plan() ? planSubtitle(this.plan()!) : 'Sub-topics, timing, hooks and the mandatory riddle.'));
  readonly chapters = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    return plan.chapters.map((c) => ({ c, start: minutesClock(c.startMin), length: minutesClock(c.lengthMin), chips: chapterChips(plan, c) }));
  });
  readonly totalLabel = computed(() => (this.plan() ? minutesClock(this.plan()!.targetDurationMin) : ''));

  constructor() {
    effect(() => {
      const p = this.project();
      if (p) void this.plans.load(p.id);
      this.versionIndex.set(0);
    });
  }

  generate() {
    const p = this.project();
    if (p) void this.plans.generate(p.id);
  }

  refine() {
    const p = this.project();
    const text = this.feedback().trim();
    if (!p || !text) return;
    this.lastFeedback.set(text);
    this.feedback.set('');
    this.versionIndex.set(0);
    void this.plans.refine(p.id, text);
  }

  tryAgain() {
    const p = this.project();
    if (!p) return;
    if (this.versions()?.length && this.lastFeedback()) void this.plans.refine(p.id, this.lastFeedback());
    else void this.plans.generate(p.id);
  }

  async approve() {
    const p = this.project();
    if (!p) return;
    this.approving.set(true);
    this.actionError.set(null);
    try {
      await this.api.approvePlan(p.id);
      await this.projects.reload(p.id);
      this.nav.go('facts');
    } catch (e) {
      this.actionError.set(errorText(e));
    } finally {
      this.approving.set(false);
    }
  }
}
