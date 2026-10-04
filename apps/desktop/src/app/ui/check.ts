import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** The design's `label.check` (i + span) as an accessible checkbox. */
@Component({
  selector: 'label[esCheck]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'check',
    role: 'checkbox',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-disabled]': 'disabled()',
    '[class.is-disabled]': 'disabled()',
    '(click)': 'toggle($event)',
    '(keydown.space)': 'toggle($event)',
    '(keydown.enter)': 'toggle($event)',
  },
  template: `<i [class.is-on]="checked()">{{ checked() ? '✓' : '' }}</i><span><ng-content /></span>`,
})
export class Check {
  readonly checked = model(false);
  readonly disabled = input(false);

  toggle(event: Event) {
    event.preventDefault();
    if (!this.disabled()) this.checked.update((v) => !v);
  }
}
