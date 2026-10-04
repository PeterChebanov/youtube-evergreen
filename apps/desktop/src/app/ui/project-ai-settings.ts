import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Api, errorText } from '../core/api.service';
import type {
  LlmCatalog,
  ProjectDto,
  ProjectLlmStageId,
  SearchOption,
  SearchProviderId,
  UpdateProjectRequest,
} from '../core/api.types';
import { ProjectStore } from '../core/stores';
import { Check } from './check';

type Mode = 'research' | 'writer' | 'both';

const RESEARCH_STAGES = new Set<ProjectLlmStageId>(['planning', 'research_queries', 'fact_extract']);
const WRITER_STAGES = new Set<ProjectLlmStageId>(['writer', 'writer_refine', 'chapter_summary']);

/** Per-project search sources and LLM model overrides (Plan / Facts / Writer). */
@Component({
  selector: 'es-project-ai-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Check],
  template: `
    <section class="panel panel-flush">
      <div class="panel-head"><h2>Project AI</h2><span class="meta">this video</span></div>
      @if (mode() !== 'writer') {
        <p class="sub" style="padding:0 12px 8px;margin:0">
          Web search runs in parallel across checked sources (Tavily, Brave, Perplexity Search, Reddit). LLM steps below are separate — use
          <span class="mono">perplexity:sonar-pro</span> for built-in Sonar search inside the model.
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
        <p class="sub" style="padding:0 12px 8px;margin:0">Model per step — format <span class="mono">provider:model-id</span> (empty = server default from .env).</p>
        @for (s of visibleStages(); track s.id) {
          <label class="field-label" style="padding:0 12px;display:block">{{ s.label }}</label>
          <input
            class="field"
            style="margin:0 12px 10px;width:calc(100% - 24px)"
            type="text"
            [attr.list]="'llm-' + s.id"
            [placeholder]="s.defaultModel"
            [value]="stageValue(s.id)"
            [disabled]="!project() || saving()"
            (input)="setStageDraft(s.id, $any($event.target).value)"
            (change)="saveStage(s.id)"
          />
          <datalist [id]="'llm-' + s.id">
            @for (m of modelPresets(); track m) {
              <option [value]="m"></option>
            }
          </datalist>
          <p class="mute" style="padding:0 12px 4px;margin:0;font-size:12px">{{ s.hint }}</p>
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
  readonly stageDraft = signal<Partial<Record<ProjectLlmStageId, string>>>({});
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly configuredIds = computed(() => this.options().filter((o) => o.configured).map((o) => o.id));

  readonly visibleStages = computed(() => {
    const stages = this.catalog()?.stages ?? [];
    const m = this.mode();
    if (m === 'both') return stages;
    if (m === 'writer') return stages.filter((s) => WRITER_STAGES.has(s.id));
    return stages.filter((s) => RESEARCH_STAGES.has(s.id));
  });

  readonly modelPresets = computed(() => this.catalog()?.modelPresets ?? []);

  constructor() {
    void this.loadMeta();
    effect(() => {
      const p = this.project();
      if (!p) return;
      this.stageDraft.set({ ...p.llmModelOverrides });
    });
  }

  isOn(id: SearchProviderId): boolean {
    const p = this.project();
    if (!p) return false;
    const selected = p.searchProviders.length ? p.searchProviders : this.configuredIds();
    return selected.includes(id);
  }

  stageValue(id: ProjectLlmStageId): string {
    return this.stageDraft()[id] ?? '';
  }

  setStageDraft(id: ProjectLlmStageId, value: string) {
    this.stageDraft.update((d) => ({ ...d, [id]: value }));
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

  saveStage(id: ProjectLlmStageId) {
    const p = this.project();
    if (!p) return;
    const raw = (this.stageDraft()[id] ?? '').trim();
    const next = { ...p.llmModelOverrides };
    if (raw) next[id] = raw;
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
