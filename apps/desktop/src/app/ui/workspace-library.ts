import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { ProjectStatus } from '@youtube-ai-tool/shared';
import { enterProject } from '../core/project-nav';
import type { WorkspacePlanDetail, WorkspaceResearchDetail, WorkspaceScriptDetail } from '../core/workspace.store';
import { WorkspaceStore } from '../core/workspace.store';
import { Nav, ProjectStore } from '../core/stores';
import { ProjectTag } from './project-tag';

type Kind = 'plan' | 'research' | 'script';

@Component({
  selector: 'es-workspace-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectTag],
  template: `
    <section class="panel panel-flush workspace-lib">
      <div class="panel-head"><h2>{{ heading() }}</h2><span class="meta">database · saved</span></div>
      @if (store.error()) { <div class="banner">{{ store.error() }}</div> }
      <div class="table-scroll">
        <table class="tbl">
          <thead>
            <tr>
              @for (col of columns(); track col) { <th>{{ col }}</th> }
              <th>Project</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @if (store.loading() && !rows().length) {
              @for (n of [1, 2, 3]; track n) {
                <tr><td [attr.colspan]="columns().length + 2"><div class="skeleton"></div></td></tr>
              }
            } @else {
              @for (row of rows(); track row.key) {
                <tr class="is-clickable" [class.is-selected]="selectedKey() === row.key" (click)="select(row.key)">
                  @for (cell of row.cells; track $index) { <td>{{ cell }}</td> }
                  <td><span class="project-tag inline">Project: <b>{{ row.projectTitle }}</b></span></td>
                  <td><button type="button" class="btn btn-sm" (click)="$event.stopPropagation(); openProject(row.projectId, row.status)">Open project</button></td>
                </tr>
              } @empty {
                <tr><td [attr.colspan]="columns().length + 2" class="mute">{{ empty() }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (detailLoading()) {
        <div style="padding:12px"><div class="skeleton"></div></div>
      } @else if (detailError()) {
        <div class="banner">{{ detailError() }}</div>
      } @else if (planDetail(); as plan) {
        <div class="artifact-detail">
          <es-project-tag [title]="plan.projectTitle" />
          <p class="mute">Plan v{{ plan.version }} · {{ plan.chapterCount }} chapters · {{ plan.targetDurationMin }} min</p>
          <div class="table-scroll">
            <table class="tbl">
              <thead><tr><th>#</th><th>Chapter</th><th>Length</th></tr></thead>
              <tbody>
                @for (c of plan.content.chapters; track c.order) {
                  <tr>
                    <td class="num">{{ c.order }}</td>
                    <td><div class="cell-title">{{ c.title }}</div><div class="cell-sub">{{ c.description }}</div></td>
                    <td class="num">{{ c.lengthMin }} min</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (researchDetail(); as research) {
        <div class="artifact-detail">
          <es-project-tag [title]="research.projectTitle" />
          <p class="mute">{{ research.facts.length }} facts</p>
          <div class="table-scroll">
            <table class="tbl">
              <thead><tr><th>Ch.</th><th>Fact</th><th>Source</th></tr></thead>
              <tbody>
                @for (f of research.facts; track f.id) {
                  <tr>
                    <td class="num">{{ f.planChapterOrder }}</td>
                    <td>{{ f.text }}</td>
                    <td class="cell-sub">{{ f.sourceTitle || f.sourceUrl }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (scriptDetail(); as script) {
        <div class="artifact-detail">
          <es-project-tag [title]="script.projectTitle" />
          <p class="mute">{{ script.title }} · {{ script.status === 'finished' ? 'finished' : 'draft' }}</p>
          <textarea class="field field-script" readonly [value]="script.text" aria-label="Script text"></textarea>
        </div>
      }
    </section>
  `,
})
export class WorkspaceLibrary {
  readonly kind = input.required<Kind>();
  readonly store = inject(WorkspaceStore);
  private readonly projects = inject(ProjectStore);
  private readonly nav = inject(Nav);

  readonly selectedKey = signal<string | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly planDetail = signal<WorkspacePlanDetail | null>(null);
  readonly researchDetail = signal<WorkspaceResearchDetail | null>(null);
  readonly scriptDetail = signal<WorkspaceScriptDetail | null>(null);

  readonly heading = computed(() => ({ plan: 'All plans', research: 'All research', script: 'All scripts' })[this.kind()]);
  readonly empty = computed(
    () =>
      ({
        plan: 'No saved plans yet. Generate a plan on the Plan tab — every version is stored.',
        research: 'No saved research yet. Facts appear here after you send a plan to research.',
        script: 'No saved scripts yet. Writer chapters and finished My Videos scripts are listed here.',
      })[this.kind()],
  );
  readonly columns = computed(() => {
    if (this.kind() === 'plan') return ['Version', 'Chapters', 'Saved'];
    if (this.kind() === 'research') return ['Facts', 'Chapters', 'Updated'];
    return ['Title', 'Status', 'Words', 'Updated'];
  });

  readonly rows = computed(() => {
    const c = this.store.catalog();
    if (!c) return [];
    if (this.kind() === 'plan') {
      return c.plans.map((p) => ({
        key: p.id,
        projectId: p.projectId,
        projectTitle: p.projectTitle,
        status: null as ProjectStatus | null,
        cells: [String(p.version), String(p.chapterCount), p.createdAt.slice(0, 10)],
      }));
    }
    if (this.kind() === 'research') {
      return c.research.map((r) => ({
        key: r.projectId,
        projectId: r.projectId,
        projectTitle: r.projectTitle,
        status: null,
        cells: [String(r.factCount), String(r.chapterCount), r.updatedAt.slice(0, 10)],
      }));
    }
    return c.scripts.map((s) => ({
      key: s.id,
      projectId: s.projectId,
      projectTitle: s.projectTitle,
      status: (s.status === 'finished' ? 'done' : 'writing') as ProjectStatus,
      cells: [s.title, s.status, String(s.wordCount), s.updatedAt.slice(0, 10)],
    }));
  });

  constructor() {
    void this.store.refresh();
  }

  select(key: string) {
    this.selectedKey.set(key);
    this.planDetail.set(null);
    this.researchDetail.set(null);
    this.scriptDetail.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    const row = this.rows().find((r) => r.key === key);
    if (!row) {
      this.detailLoading.set(false);
      return;
    }
    void this.loadDetail(row.key, row.projectId);
  }

  openProject(projectId: string, status: ProjectStatus | null) {
    const p = this.projects.projects().find((x) => x.id === projectId);
    enterProject(this.projects, this.nav, projectId, status ?? p?.status ?? null);
  }

  private async loadDetail(key: string, projectId: string) {
    try {
      if (this.kind() === 'plan') this.planDetail.set(await this.store.planDetail(key));
      else if (this.kind() === 'research') this.researchDetail.set(await this.store.researchDetail(projectId));
      else this.scriptDetail.set(await this.store.scriptDetail(projectId));
    } catch (e) {
      this.detailError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.detailLoading.set(false);
    }
  }
}
