import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** URL (or text) + primary action on one row; optional extras (e.g. LLM) projected below. */
@Component({
  selector: 'es-action-url-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="action-url-form" (submit)="onSubmit($event)">
      <div class="action-url-row">
        <input
          class="field action-url-input"
          [id]="inputId()"
          type="text"
          [attr.placeholder]="placeholder()"
          [attr.aria-label]="ariaLabel()"
          [value]="value()"
          [disabled]="inputDisabled()"
          (input)="valueChange.emit($any($event.target).value)"
        />
        <button class="btn btn-primary action-url-btn" type="submit" [disabled]="submitDisabled()">{{ actionLabel() }}</button>
      </div>
      <div class="action-url-extra"><ng-content /></div>
    </form>
  `,
})
export class ActionUrlForm {
  readonly inputId = input.required<string>();
  readonly placeholder = input('');
  readonly ariaLabel = input('');
  readonly actionLabel = input.required<string>();
  readonly value = input('');
  readonly submitDisabled = input(false);
  readonly inputDisabled = input(false);

  readonly valueChange = output<string>();
  readonly submitForm = output<void>();

  onSubmit(event: Event) {
    event.preventDefault();
    if (!this.submitDisabled()) this.submitForm.emit();
  }
}
