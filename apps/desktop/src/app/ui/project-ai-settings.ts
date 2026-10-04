import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Api, errorText } from '../core/api.service';
import type { LlmDefaults, ProjectDto, SearchOption, SearchProviderId, UpdateProjectRequest } from '../core/api.types';
import { ProjectStore } from '../core/stores';
import { Check } from './check';

type Mode = 'research' | 'writer' | 'both';

/** Per-project search sources and LLM model overrides (Plan / Facts / Writer). */
@Component({
  selector: 'es-project-ai-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Check],
  template: `
    <section class="panel panel-flush">
      <div class="panel-head"><h2>Project AI</h2><span class="meta">this video</span></div>
      @if (mode() !== 'writer') {
        <p class="sub" style="padding:0 12px 8px;margin:0">Check where to search for facts. With none checked, all sources that have API keys in .env are used.</p>
        <div class="stack" style="padding:0 12px 10px">
          @for (o of options(); track o.id) {
            <label esCheck [checked]="isOn(o.id)" [disabled]="!o.configured || saving()" (checkedChange)="toggle(o.id, $event)">
              {{ o.label }}@if (!o.configured) { <span class="mute"> · no API key</span> }
            </label>
          }
        </div>
        <label class="field-label" style="padding:0 12px;display:block">Research model</label>
        <input class="field" style="margin:0 12px 10px;width:calc(100% - 24px)" type="text" [placeholder]="defaults()?.researchModel ?? 'from .env'"
          [value]="researchModel()" [disabled]="!project() || saving()"
          (input)="researchModel.set($any($event.target).value)" (change)="saveModels()" />
      }
      @if (mode() === 'writer' || mode() === 'both') {
        <label class="field-label" style="padding:0 12px;display:block">Author model (Writer chapters)</label>
        <input class="field" style="margin:0 12px 12px;width:calc(100% - 24px)" type="text" [placeholder]="defaults()?.writerModel ?? 'from .env'"
          [value]="writerModel()" [disabled]="!project() || saving()"
          (input)="writerModel.set($any($event.target).value)" (change)="saveModels()" />
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
  readonly defaults = signal<LlmDefaults | null>(null);
  readonly researchModel = signal('');
  readonly writerModel = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly configuredIds = computed(() => this.options().filter((o) => o.configured).map((o) => o.id));

  constructor() {
    void this.loadMeta();
    effect(() => {
      const p = this.project();
      if (!p) return;
      this.researchModel.set(p.llmResearchModel ?? '');
      this.writerModel.set(p.llmWriterModel ?? '');
    });
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

  saveModels() {
    const research = this.researchModel().trim();
    const writer = this.writerModel().trim();
    void this.patch({ llmResearchModel: research || null, llmWriterModel: writer || null });
  }

  private async loadMeta() {
    try {
      const [options, defaults] = await Promise.all([this.api.searchOptions(), this.api.llmDefaults()]);
      this.options.set(options);
      this.defaults.set(defaults);
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
