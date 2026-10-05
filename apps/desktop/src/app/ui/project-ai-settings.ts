import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PROJECT_LLM_STAGES, type LlmStageId } from '@youtube-ai-tool/shared';
import { Api, errorText } from '../core/api.service';
import type { LlmCatalog, ProjectDto, SearchOption, SearchProviderId, UpdateProjectRequest } from '../core/api.types';
import { ProjectStore } from '../core/stores';
import { Check } from './check';
import { LlmVendorSelect } from './llm-vendor-select';

type Mode = 'research' | 'writer' | 'both';

const RESEARCH_STAGE_IDS = new Set<LlmStageId>(['planning', 'plan_shallow_queries', 'fact_research_queries', 'fact_extract']);
const WRITER_STAGE_IDS = new Set<LlmStageId>(['writer', 'writer_refine', 'chapter_summary']);

/** Per-project search sources and LLM vendor per pipeline step. */
@Component({
  selector: 'es-project-ai-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Check, LlmVendorSelect],
  template: `
    <section class="panel panel-flush">
      <div class="panel-head"><h2>Project AI</h2><span class="meta">this video</span></div>
      @if (mode() !== 'writer') {
        <p class="sub" style="padding:0 12px 8px;margin:0">
          Web search runs in parallel across checked sources. LLM steps below choose which model analyzes results.
        </p>
        <div class="stack" style="padding:0 12px 10px">
          @for (o of options(); track o.id) {
            <label esCheck [checked]="isOn(o.id)" [disabled]="!o.configured || saving()" (checkedChange)="toggle(o.id, $event)">
              {{ o.label }}@if (!o.configured) { <span class="mute"> · no API key</span> }
            </label>
          }
        </div>
      }
      @if (visibleStages().length) {
        <p class="sub" style="padding:0 12px 8px;margin:0">One LLM per step (from your .env keys).</p>
        @for (s of visibleStages(); track s.id) {
          <div style="padding:0 12px 10px">
            <es-llm-vendor-select
              [label]="s.label"
              [stageId]="s.id"
              [catalog]="catalog()"
              [vendor]="stageVendor(s.id)"
              [disabled]="!project() || saving()"
              (vendorChange)="saveStage(s.id, $event)"
            />
            <p class="mute" style="margin:4px 0 0;font-size:12px">{{ s.hint }}</p>
          </div>
        }
      }
      @if (error()) {
        <div class="banner" style="margin:0 12px 12px">{{ error() }}</div>
      }
    </section>
  `,
})
export class ProjectAiSettings {
  private readonly api = inject(Api);
  private readonly projects = inject(ProjectStore);
  readonly project = input.required<ProjectDto | null>();
  readonly mode = input<Mode>('both');

  readonly options = signal<SearchOption[]>([]);
  readonly catalog = signal<LlmCatalog | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly configuredIds = computed(() => this.options().filter((o) => o.configured).map((o) => o.id));

  readonly visibleStages = computed(() => {
    const stages = this.catalog()?.stages.filter((s) => s.projectScoped) ?? PROJECT_LLM_STAGES;
    const m = this.mode();
    if (m === 'both') return stages;
    if (m === 'writer') return stages.filter((s) => WRITER_STAGE_IDS.has(s.id));
    return stages.filter((s) => RESEARCH_STAGE_IDS.has(s.id));
  });

  constructor() {
    void this.loadMeta();
  }

  stageVendor(id: LlmStageId): string | null {
    const v = this.project()?.llmModelOverrides[id];
    return v ?? null;
  }

  isOn(id: SearchProviderId): boolean {
    const p = this.project();
    if (!p) return false;
    const selected = p.searchProviders.length ? p.searchProviders : this.configuredIds();
    return selected.includes(id);
  }

  toggle(id: SearchProviderId, on: boolean) {
    const p = this.project();
    if (!p) return;
    const base = p.searchProviders.length ? [...p.searchProviders] : [...this.configuredIds()];
    const next = on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
    if (!next.length) {
      this.error.set('Pick at least one search source.');
      return;
    }
    void this.patch({ searchProviders: next });
  }

  saveStage(id: LlmStageId, vendor: string | null) {
    const p = this.project();
    if (!p) return;
    const next = { ...p.llmModelOverrides };
    if (vendor) next[id] = vendor;
    else delete next[id];
    void this.patch({ llmModelOverrides: next });
  }

  private async loadMeta() {
    try {
      const [options, catalog] = await Promise.all([this.api.searchOptions(), this.api.llmCatalog()]);
      this.options.set(options);
      this.catalog.set(catalog);
    } catch {
      this.options.set([]);
    }
  }

  private async patch(body: UpdateProjectRequest) {
    const p = this.project();
    if (!p) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.projects.upsert(await this.api.updateProject(p.id, body));
      if (this.projects.currentId() === p.id) await this.projects.reload(p.id);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }
}
