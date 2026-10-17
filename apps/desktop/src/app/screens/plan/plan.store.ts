import { Injectable, inject, signal } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import type { PlanDraft } from '@youtube-ai-tool/shared';
import type { PlanVersion } from '../../core/api.types';
import { ProjectStore } from '../../core/stores';
import { WorkspaceStore } from '../../core/workspace.store';

type PlanState = { versions: PlanVersion[] | null; busy: 'generating' | 'refining' | null; error: string | null };

const EMPTY: PlanState = { versions: null, busy: null, error: null };

/** Plan versions per project; generation keeps running when the author switches tabs. */
@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly api = inject(Api);
  private readonly projects = inject(ProjectStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly states = signal<Record<string, PlanState>>({});
  private readonly loadSeq = new Map<string, number>();

  state(projectId: string): PlanState {
    return this.states()[projectId] ?? EMPTY;
  }

  async load(projectId: string) {
    if (this.state(projectId).busy) return;
    const seq = (this.loadSeq.get(projectId) ?? 0) + 1;
    this.loadSeq.set(projectId, seq);
    try {
      const versions = await this.api.planVersions(projectId);
      if (this.loadSeq.get(projectId) !== seq || this.state(projectId).busy) return;
      this.patch(projectId, { versions, error: null });
    } catch (e) {
      if (this.loadSeq.get(projectId) !== seq) return;
      this.patch(projectId, { error: errorText(e) });
    }
  }

  generate(projectId: string) {
    return this.run(projectId, 'generating', () => this.api.generatePlan(projectId));
  }

  refine(projectId: string, feedback: string) {
    return this.run(projectId, 'refining', () => this.api.refinePlan(projectId, feedback));
  }

  refineChapter(projectId: string, order: number, feedback: string) {
    return this.run(projectId, 'refining', () => this.api.refinePlanChapter(projectId, order, feedback));
  }

  retryChapter(projectId: string, order: number, feedback?: string) {
    return this.run(projectId, 'refining', () => this.api.retryPlanChapter(projectId, order, feedback));
  }

  addChapter(
    projectId: string,
    body: { insertAfter: number; description: string; lengthMin: number; title?: string },
  ) {
    return this.run(projectId, 'refining', () => this.api.addPlanChapter(projectId, body));
  }

  refineAllChapters(projectId: string) {
    return this.run(projectId, 'refining', () => this.api.refineAllPlanChapters(projectId));
  }

  saveManual(projectId: string, draft: PlanDraft) {
    return this.run(projectId, 'refining', () => this.api.savePlan(projectId, draft));
  }

  rescaleToTarget(projectId: string) {
    return this.run(projectId, 'refining', () => this.api.rescalePlanToTarget(projectId));
  }

  private async run(projectId: string, busy: PlanState['busy'], action: () => Promise<PlanVersion>) {
    if (this.state(projectId).busy) return;
    this.patch(projectId, { busy, error: null });
    try {
      const created = await action();
      this.patch(projectId, { versions: [created, ...(this.state(projectId).versions ?? []).filter((v) => v.version !== created.version)] });
    } catch (e) {
      this.patch(projectId, { error: errorText(e) });
    } finally {
      this.patch(projectId, { busy: null });
      await this.projects.reload(projectId).catch(() => undefined);
      void this.workspace.refresh();
      void this.load(projectId);
    }
  }

  private patch(projectId: string, change: Partial<PlanState>) {
    this.states.update((all) => ({ ...all, [projectId]: { ...(all[projectId] ?? EMPTY), ...change } }));
  }
}
