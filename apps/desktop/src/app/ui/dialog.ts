import { ChangeDetectionStrategy, Component, ElementRef, Injectable, effect, inject, signal, viewChild } from '@angular/core';

export type ConfirmOptions = {
  title: string;
  rows: Array<{ label: string; value: string }>;
  confirmLabel: string;
  cancelLabel?: string;
  warning?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

@Injectable({ providedIn: 'root' })
export class Dialogs {
  readonly pending = signal<Pending | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  close(ok: boolean) {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
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
    }
  `,
})
export class DialogHost {
  readonly dialogs = inject(Dialogs);
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirm');

  constructor() {
    effect(() => this.confirmButton()?.nativeElement.focus());
  }
}
