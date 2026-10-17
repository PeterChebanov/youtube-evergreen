import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'es-project-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'project-tag-wrap' },
  template: `<span class="project-tag">Project: <b>{{ title() }}</b></span>`,
})
export class ProjectTag {
  readonly title = input.required<string>();
}
