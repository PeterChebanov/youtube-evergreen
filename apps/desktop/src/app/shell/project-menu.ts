import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api, errorText } from '../core/api.service';
import { Nav, ProjectStore } from '../core/stores';
import { Dialogs } from '../ui/dialog';

const STATUS_LABEL: Record<string, string> = {
  draft: 'draft',
  planning: 'plan',
  plan_approved: 'facts',
  researching: 'facts',
  research_approved: 'writer',
  writing: 'writer',
  done: 'done',
};

const STATUS_SCREEN = { draft: 'plan', planning: 'plan', plan_approved: 'facts', researching: 'facts', research_approved: 'writer', writing: 'writer', done: 'videos' } as const;

@Component({
  selector: 'es-project-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'menu-anchor', '(document:click)': 'open.set(false)', '(click)': '$event.stopPropagation()' },
  template: `
    <button class="projsel" type="button" aria-haspopup="true" [attr.title]="label()" [attr.aria-expanded]="open()" (click)="toggle()">Project: {{ label() }} ▾</button>
    @if (open()) {
      <section class="panel menu" aria-label="Projects">
        <div class="panel-head"><h2>Projects</h2><span class="meta">{{ store.projects().length }}</span></div>
        @if (error()) { <div class="banner">{{ error() }}</div> }
        <div class="chlist">
          @for (p of store.projects(); track p.id) {
            <a tabindex="0" [class.is-active]="p.id === store.currentId()" [title]="p.title" (click)="pick(p.id)" (keydown.enter)="pick(p.id)">
              <b>{{ p.title }}</b><span>{{ statusLabel[p.status] ?? p.status }}</span></a>
          } @empty {
            <p class="mute">No projects yet. Start one from Advice.</p>
          }
        </div>
        @if (store.current(); as current) {
          <div class="dialog-actions">
            <button class="btn btn-sm" type="button" (click)="remove(current.id, current.title)">Delete project</button>
          </div>
        }
      </section>
    }
  `,
})
export class ProjectMenu {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  private readonly dialogs = inject(Dialogs);
  readonly store = inject(ProjectStore);
  readonly open = signal(false);
  readonly error = signal<string | null>(null);
  readonly statusLabel = STATUS_LABEL;
  readonly label = computed(() => this.store.current()?.title ?? 'none');

  toggle() {
    this.open.update((v) => !v);
    if (this.open()) void this.store.refresh();
  }

  pick(id: string) {
    this.store.select(id);
    this.open.set(false);
    const status = this.store.current()?.status;
    if (status) this.nav.go(STATUS_SCREEN[status]);
  }

  async remove(id: string, title: string) {
    this.open.set(false);
    const ok = await this.dialogs.confirm({
      title: 'Delete project',
      rows: [{ label: 'Project', value: title }],
      warning: 'The plan, facts and script drafts of this project are deleted. A finished script also leaves My Videos.',
      confirmLabel: 'Delete project',
    });
    if (!ok) return;
    try {
      await this.api.deleteProject(id);
      this.store.select(null);
      await this.store.refresh();
    } catch (e) {
      this.error.set(errorText(e));
    }
  }
}
