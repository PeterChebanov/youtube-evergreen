import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  TARGET_DURATION_DEFAULT,
  TARGET_DURATION_MAX,
  TARGET_DURATION_MIN,
  canEditPlan,
  planTotalDurationMin,
  targetWordsForVideo,
} from '@youtube-ai-tool/shared';
import { Api, errorText } from '../../core/api.service';
import { Dialogs } from '../../ui/dialog';
import { minutesClock } from '../../core/format';
import { Nav, ProjectStore } from '../../core/stores';
import { ProjectAiSettings } from '../../ui/project-ai-settings';
import { ProjectTag } from '../../ui/project-tag';
import { WorkspaceLibrary } from '../../ui/workspace-library';
import { PlanStore } from './plan.store';
import { chapterChips, planSubtitle, planToDraft, riddleMarkers } from './plan.view';

@Component({
  selector: 'section[esPlan]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectAiSettings, ProjectTag, WorkspaceLibrary],
  host: { class: 'screen', id: 'screen-plan', 'data-screen': 'plan' },
  templateUrl: './plan.screen.html',
})
export class PlanScreen {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  private readonly dialogs = inject(Dialogs);
  private readonly plans = inject(PlanStore);
  readonly projects = inject(ProjectStore);

  readonly editMode = signal(false);
  readonly feedback = signal('');
  readonly lastFeedback = signal('');
  readonly versionIndex = signal(0);
  readonly approving = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly showAddChapter = signal(false);
  readonly newChapterTitle = signal('');
  readonly newChapterDescription = signal('');
  readonly newChapterLengthMin = signal(8);
  readonly newChapterInsertAfter = signal(0);

  readonly project = this.projects.current;
  readonly projectId = computed(() => this.project()?.id ?? null);
  readonly state = computed(() => {
    const p = this.project();
    return p ? this.plans.state(p.id) : null;
  });
  readonly versions = computed(() => this.state()?.versions ?? null);
  readonly version = computed(() => this.versions()?.[Math.min(this.versionIndex(), (this.versions()?.length ?? 1) - 1)] ?? null);
  readonly plan = computed(() => this.version()?.content ?? null);
  /** Target duration, add chapter, timeline remove — need unlock after plan is sent to research. */
  readonly editable = computed(() => {
    const status = this.project()?.status;
    if (!status || !canEditPlan(status)) return false;
    if (status === 'draft' || status === 'planning') return true;
    return this.editMode();
  });
  /** Edit / Retry / Delete on each chapter row (matches requirements; API allows while canEditPlan). */
  readonly chapterRowActions = computed(() => {
    const status = this.project()?.status;
    return !!status && canEditPlan(status);
  });
  readonly showEditUnlock = computed(() => {
    const status = this.project()?.status;
    return !!status && canEditPlan(status) && status !== 'draft' && status !== 'planning' && !this.editMode();
  });
  readonly showApprove = computed(() => ['draft', 'planning'].includes(this.project()?.status ?? ''));
  readonly busy = computed(() => this.state()?.busy ?? null);
  readonly markers = computed(() => (this.plan() ? riddleMarkers(this.plan()!) : []));
  readonly subtitle = computed(() => (this.plan() ? planSubtitle(this.plan()!) : 'Sub-topics, timing, hooks and the mandatory riddle.'));
  readonly chapters = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    return plan.chapters.map((c) => ({ c, start: minutesClock(c.startMin), length: minutesClock(c.lengthMin), chips: chapterChips(plan, c) }));
  });
  readonly totalLabel = computed(() => (this.plan() ? minutesClock(planTotalDurationMin(this.plan()!)) : ''));
  readonly targetLabel = computed(() => (this.plan() ? minutesClock(this.plan()!.targetDurationMin) : ''));
  readonly wordHint = computed(() => {
    const p = this.project();
    if (!p) return '';
    const w = targetWordsForVideo(p.targetDurationMin);
    return `${w.min.toLocaleString('en-US')}–${w.max.toLocaleString('en-US')}`;
  });

  constructor() {
    effect(() => {
      const id = this.projectId();
      if (id) void this.plans.load(id);
      this.versionIndex.set(0);
      this.editMode.set(false);
    });
  }

  unlockEdit() {
    this.editMode.set(true);
    this.actionError.set(null);
  }

  async editChapter(order: number, title: string) {
    const p = this.project();
    if (!p || !this.chapterRowActions() || this.busy()) return;
    const feedback = await this.dialogs.prompt({
      title: `Edit chapter ${order}`,
      description: title,
      placeholder: 'What to add, remove, or change in this chapter…',
      confirmLabel: 'Edit chapter',
    });
    if (!feedback?.trim()) return;
    this.versionIndex.set(0);
    await this.plans.refineChapter(p.id, order, feedback.trim());
  }

  async retryChapter(order: number, title: string) {
    const p = this.project();
    if (!p || !this.chapterRowActions() || this.busy()) return;
    const notes = await this.dialogs.prompt({
      title: `Retry chapter ${order}`,
      description: title,
      placeholder: 'Optional: what to emphasize (e.g. 2026 facts, AI angle)…',
      confirmLabel: 'Retry chapter',
      allowEmpty: true,
    });
    if (notes === null) return;
    this.versionIndex.set(0);
    await this.plans.retryChapter(p.id, order, notes);
  }

  refineAllChapters() {
    const p = this.project();
    if (!p || !this.editable() || this.busy() || !this.plan()) return;
    this.versionIndex.set(0);
    void this.plans.refineAllChapters(p.id);
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

  private clampDuration(n: number) {
    return Math.min(TARGET_DURATION_MAX, Math.max(TARGET_DURATION_MIN, Math.round(n) || TARGET_DURATION_DEFAULT));
  }

  async saveDuration(minutes: number) {
    const p = this.project();
    if (!p) return;
    try {
      this.projects.upsert(await this.api.updateProject(p.id, { targetDurationMin: this.clampDuration(minutes) }));
      if (this.editable()) {
        await this.plans.rescaleToTarget(p.id);
        this.versionIndex.set(0);
      }
    } catch (e) {
      this.actionError.set(errorText(e));
    }
  }

  async removeChapter(chapterOrder: number) {
    const p = this.project();
    const content = this.plan();
    if (!p || !content || !this.editable() || this.busy()) return;
    const next = content.chapters.filter((c) => c.order !== chapterOrder);
    if (!next.length) {
      this.actionError.set('The plan must keep at least one chapter.');
      return;
    }
    this.actionError.set(null);
    const draft = planToDraft(content);
    draft.chapters = next.map((c) => ({
      title: c.title,
      description: c.description,
      lengthMin: c.lengthMin,
      subpoints: c.subpoints ?? [],
      hooks: c.hooks ?? [],
      techniques: c.techniques ?? [],
      ending: c.ending ?? '',
      bridge: c.bridge ?? '',
      buildsOn: c.buildsOn ?? '',
      doNotRepeat: c.doNotRepeat ?? [],
    }));
    await this.plans.saveManual(p.id, draft);
    this.versionIndex.set(0);
  }

  async addChapter() {
    const p = this.project();
    const content = this.plan();
    const title = this.newChapterTitle().trim();
    const description = this.newChapterDescription().trim();
    const lengthMin = Math.max(0.5, this.newChapterLengthMin());
    const insertAfter = this.newChapterInsertAfter();
    if (!p || !content || !this.editable() || this.busy() || !description) return;
    await this.plans.addChapter(p.id, {
      insertAfter,
      description,
      lengthMin,
      title: title || undefined,
    });
    this.newChapterTitle.set('');
    this.newChapterDescription.set('');
    this.newChapterLengthMin.set(8);
    this.newChapterInsertAfter.set(content.chapters.length);
    this.showAddChapter.set(false);
    this.versionIndex.set(0);
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
