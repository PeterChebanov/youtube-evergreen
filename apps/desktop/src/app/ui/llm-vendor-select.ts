import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { LlmCatalog, LlmStageId } from '../core/api.types';
import { defaultVendorForStage, writeStageVendor } from '../core/llm-preferences';

/** Dropdown of configured LLM vendors (GPT, Claude, Gemini, Grok, Perplexity). */
@Component({
  selector: 'es-llm-vendor-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="select" [class.is-disabled]="disabled()">
      {{ label() }}:
      <select
        [attr.aria-label]="label()"
        [disabled]="disabled() || !options().length"
        [value]="selected() ?? ''"
        (change)="onChange($any($event.target).value)"
      >
        @if (!options().length) {
          <option value="">No LLM configured</option>
        } @else {
          @for (v of options(); track v.id) {
            <option [value]="v.id" [selected]="v.id === selected()">{{ v.label }}@if (v.modelRef) { · {{ v.modelRef }} }</option>
          }
        }
      </select>
      ▾
    </label>
  `,
})
export class LlmVendorSelect {
  readonly label = input('LLM');
  readonly stageId = input<LlmStageId | null>(null);
  readonly catalog = input<LlmCatalog | null>(null);
  readonly vendor = input<string | null>(null);
  readonly disabled = input(false);
  readonly remember = input(true);

  readonly vendorChange = output<string | null>();

  readonly options = computed(() => (this.catalog()?.vendors ?? []).filter((v) => v.configured));
  readonly selected = signal<string | null>(null);

  constructor() {
    effect(() => {
      const explicit = this.vendor();
      if (explicit !== null && explicit !== undefined) {
        this.selected.set(explicit);
        return;
      }
      const stage = this.stageId();
      if (stage) this.selected.set(defaultVendorForStage(stage, this.catalog()));
      else this.selected.set(this.options()[0]?.id ?? null);
    });
  }

  onChange(raw: string) {
    const next = raw?.trim() || null;
    this.selected.set(next);
    const stage = this.stageId();
    if (this.remember() && stage && next) writeStageVendor(stage, next);
    this.vendorChange.emit(next);
  }
}
