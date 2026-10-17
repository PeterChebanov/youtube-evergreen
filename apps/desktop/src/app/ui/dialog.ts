import { ChangeDetectionStrategy, Component, ElementRef, Injectable, effect, inject, signal, viewChild } from '@angular/core';

export type ConfirmOptions = {
  title: string;
  rows: Array<{ label: string; value: string }>;
  confirmLabel: string;
  cancelLabel?: string;
  warning?: string;
};

export type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  defaultValue?: string;
  /** When true, confirm returns trimmed text (may be empty). Otherwise empty confirm acts like cancel. */
  allowEmpty?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };
type PendingPrompt = PromptOptions & { resolve: (value: string | null) => void };

@Injectable({ providedIn: 'root' })
export class Dialogs {
  readonly pending = signal<PendingConfirm | null>(null);
  readonly pendingPrompt = signal<PendingPrompt | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.pendingPrompt()?.resolve(null);
    this.pendingPrompt.set(null);
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  close(ok: boolean) {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
  }

  prompt(options: PromptOptions): Promise<string | null> {
    this.pending()?.resolve(false);
    this.pending.set(null);
    this.pendingPrompt()?.resolve(null);
    return new Promise((resolve) => this.pendingPrompt.set({ ...options, resolve }));
  }

  closePrompt(value: string | null, confirmed = false) {
    const p = this.pendingPrompt();
    this.pendingPrompt.set(null);
    if (!p) return;
    const trimmed = value?.trim() ?? '';
    if (confirmed && p.allowEmpty) {
      p.resolve(trimmed);
      return;
    }
    p.resolve(trimmed || null);
  }
}

/** Confirm dialog built from .panel, .banner and .btn (DESIGN_SPEC 9). */
@Component({
  selector: 'es-dialog-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dialogs.pending(); as d) {
      <div class="overlay" (click)="dialogs.close(false)" (keydown.escape)="dialogs.close(false)">
        <section class="panel" role="dialog" aria-modal="true" [attr.aria-label]="d.title" (click)="$event.stopPropagation()">
          <div class="panel-head"><h2>{{ d.title }}</h2></div>
          <ul class="kv">
            @for (row of d.rows; track row.label) {
              <li><span>{{ row.label }}</span><div>{{ row.value }}</div></li>
            }
          </ul>
          @if (d.warning) {
            <div class="banner" style="margin-top:12px">{{ d.warning }}</div>
          }
          <div class="dialog-actions">
            <button class="btn" type="button" (click)="dialogs.close(false)">{{ d.cancelLabel ?? 'Cancel' }}</button>
            <button #confirm class="btn btn-primary" type="button" (click)="dialogs.close(true)">{{ d.confirmLabel }}</button>
          </div>
        </section>
      </div>
    } @else if (dialogs.pendingPrompt(); as p) {
      <div class="overlay" (click)="dialogs.closePrompt(null)" (keydown.escape)="dialogs.closePrompt(null)">
        <section class="panel" role="dialog" aria-modal="true" [attr.aria-label]="p.title" (click)="$event.stopPropagation()">
          <div class="panel-head"><h2>{{ p.title }}</h2></div>
          @if (p.description) {
            <p class="sub" style="margin-bottom:12px">{{ p.description }}</p>
          }
          <textarea #promptInput class="field" rows="4" [attr.placeholder]="p.placeholder ?? ''" [value]="p.defaultValue ?? ''"></textarea>
          <div class="dialog-actions">
            <button class="btn" type="button" (click)="dialogs.closePrompt(null)">{{ p.cancelLabel ?? 'Cancel' }}</button>
            <button class="btn btn-primary" type="button" (click)="dialogs.closePrompt(promptInput.value, true)">{{ p.confirmLabel }}</button>
          </div>
        </section>
      </div>
    }
  `,
})
export class DialogHost {
  readonly dialogs = inject(Dialogs);
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirm');
  private readonly promptInput = viewChild<ElementRef<HTMLTextAreaElement>>('promptInput');

  constructor() {
    effect(() => this.confirmButton()?.nativeElement.focus());
    effect(() => {
      const el = this.promptInput()?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }
}
