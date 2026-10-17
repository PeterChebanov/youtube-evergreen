import { Injectable, inject, signal } from '@angular/core';
import type {
  WorkspaceCatalog,
  WorkspacePlanDetail,
  WorkspaceResearchDetail,
  WorkspaceScriptDetail,
} from '@youtube-ai-tool/shared';
import { Api, errorText } from './api.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly api = inject(Api);
  readonly catalog = signal<WorkspaceCatalog | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async refresh() {
    this.loading.set(true);
    try {
      this.catalog.set(await this.api.workspaceCatalog());
      this.error.set(null);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  planDetail(planVersionId: string) {
    return this.api.workspacePlan(planVersionId);
  }

  researchDetail(projectId: string) {
    return this.api.workspaceResearch(projectId);
  }

  scriptDetail(projectId: string) {
    return this.api.workspaceScript(projectId);
  }
}

export type { WorkspacePlanDetail, WorkspaceResearchDetail, WorkspaceScriptDetail };
