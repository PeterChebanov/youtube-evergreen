import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { Api, errorText } from '../../core/api.service';

@Component({
  selector: 'es-writer-full-text-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="overlay" (click)="cancel()" (keydown.escape)="cancel()">
        <section class="panel panel-wide" role="dialog" aria-modal="true" aria-label="Full script" (click)="$event.stopPropagation()">
          <div class="panel-head row-between">
            <h2>Full script</h2>
            <span class="actions">
              <button class="btn btn-sm" type="button" [disabled]="busy()" (click)="snippetOpen.set(true)">Refine snippet</button>
            </span>
          </div>
          @if (loadError()) {
            <div class="banner" style="margin:0 12px">{{ loadError() }}</div>
          }
          <textarea
            #mainEditor
            class="field field-script"
            style="margin:12px;min-height:50vh"
            aria-label="Full script text"
            [value]="fullText()"
            (input)="fullText.set($any($event.target).value)"
            (mouseup)="grabSelection(mainEditor)"
            (keyup)="grabSelection(mainEditor)"
          ></textarea>
          <div class="dialog-actions">
            <button class="btn" type="button" [disabled]="busy()" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" type="button" [disabled]="busy() || !fullText().trim()" (click)="save()">Save changes</button>
          </div>
        </section>
      </div>
    }

    @if (open() && snippetOpen()) {
      <section class="snippet-panel panel" role="dialog" aria-label="Refine snippet">
        <div class="panel-head row-between">
          <h2>Refine snippet</h2>
          <button class="btn btn-sm" type="button" (click)="snippetOpen.set(false)">Close</button>
        </div>
        <div class="field-group" style="padding:12px">
          <label class="select">Excerpt
            <button class="btn btn-sm" type="button" (click)="pasteSelection()">Use selection from script</button>
          </label>
          <textarea class="field" rows="4" aria-label="Snippet to refine" [value]="fragment()" (input)="fragment.set($any($event.target).value)"></textarea>
          <textarea class="field" rows="3" aria-label="Refine instructions" placeholder="What to change in this excerpt…"
            [value]="instructions()" (input)="instructions.set($any($event.target).value)"></textarea>
          <button class="btn btn-primary btn-sm" type="button" [disabled]="snippetBusy() || !fragment().trim() || !instructions().trim()" (click)="runSnippetRefine()">
            Refine
          </button>
          @if (snippetError()) { <div class="field-error">{{ snippetError() }}</div> }
          <label class="select" style="margin-top:12px">Result (copy into script manually)</label>
          <textarea class="field" rows="5" aria-label="Refined snippet result" [value]="snippetResult()" (input)="snippetResult.set($any($event.target).value)"></textarea>
        </div>
      </section>
    }
  `,
})
export class WriterFullTextDialog {
  private readonly api = inject(Api);

  constructor() {
    effect(() => {
      const id = this.projectId();
      if (this.open() && id) void this.loadForProject(id);
    });
  }

  readonly open = input(false);
  readonly projectId = input<string | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly fullText = signal('');
  readonly busy = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly snippetOpen = signal(false);
  readonly fragment = signal('');
  readonly instructions = signal('');
  readonly snippetResult = signal('');
  readonly snippetBusy = signal(false);
  readonly snippetError = signal<string | null>(null);

  private readonly mainEditor = viewChild<ElementRef<HTMLTextAreaElement>>('mainEditor');
  private lastSelection = '';

  async loadForProject(id: string) {
    this.loadError.set(null);
    this.snippetOpen.set(false);
    try {
      this.fullText.set((await this.api.scriptFullText(id)).fullText);
    } catch (e) {
      this.loadError.set(errorText(e));
      this.fullText.set('');
    }
  }

  grabSelection(el: HTMLTextAreaElement) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start !== end) this.lastSelection = el.value.slice(start, end);
  }

  pasteSelection() {
    if (this.lastSelection) this.fragment.set(this.lastSelection);
    else {
      const el = this.mainEditor()?.nativeElement;
      if (el && el.selectionStart !== el.selectionEnd) this.fragment.set(el.value.slice(el.selectionStart, el.selectionEnd));
    }
  }

  async runSnippetRefine() {
    const id = this.projectId();
    if (!id) return;
    this.snippetBusy.set(true);
    this.snippetError.set(null);
    try {
      const { text } = await this.api.refineScriptSnippet(id, this.fragment().trim(), this.instructions().trim());
      this.snippetResult.set(text);
    } catch (e) {
      this.snippetError.set(errorText(e));
    } finally {
      this.snippetBusy.set(false);
    }
  }

  cancel() {
    this.snippetOpen.set(false);
    this.closed.emit();
  }

  async save() {
    const id = this.projectId();
    if (!id || !this.fullText().trim()) return;
    this.busy.set(true);
    this.loadError.set(null);
    try {
      await this.api.saveScriptFullText(id, this.fullText());
      this.saved.emit();
      this.snippetOpen.set(false);
      this.closed.emit();
    } catch (e) {
      this.loadError.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
