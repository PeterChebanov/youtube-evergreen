import { Injectable, inject, signal } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import type { PlanVersion } from '../../core/api.types';
import { ProjectStore } from '../../core/stores';

type PlanState = { versions: PlanVersion[] | null; busy: 'generating' | 'refining' | null; error: string | null };

const EMPTY: PlanState = { versions: null, busy: null, error: null };

/** Plan versions per project; generation keeps running when the author switches tabs. */
@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly api = inject(Api);
  private readonly projects = inject(ProjectStore);
  private readonly states = signal<Record<string, PlanState>>({});

  state(projectId: string): PlanState {
    return this.states()[projectId] ?? EMPTY;
  }

  async load(projectId: string) {
    try {
      this.patch(projectId, { versions: await this.api.planVersions(projectId), error: null });
    } catch (e) {
      this.patch(projectId, { error: errorText(e) });
    }
  }

  generate(projectId: string) {
    return this.run(projectId, 'generating', () => this.api.generatePlan(projectId));
  }

  refine(projectId: string, feedback: string) {
    return this.run(projectId, 'refining', () => this.api.refinePlan(projectId, feedback));
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
    }
  }

  private patch(projectId: string, change: Partial<PlanState>) {
    this.states.update((all) => ({ ...all, [projectId]: { ...(all[projectId] ?? EMPTY), ...change } }));
  }
}
