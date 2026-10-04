import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { EXTRA_SCREENS, ScreenId, TABS } from '../core/screens';
import { Nav } from '../core/stores';

type Command = { id: string; label: string; hint: string; run: () => void };

/** ⌘K jump list: a plain command list built from .panel and .chlist (DESIGN_SPEC 9). */
@Component({
  selector: 'es-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay" (click)="closed.emit()">
      <section class="panel" role="dialog" aria-label="Jump to" (click)="$event.stopPropagation()">
        <input #query class="field" type="text" placeholder="Jump to…" aria-label="Jump to"
          [value]="text()" (input)="text.set($any($event.target).value); active.set(0)"
          (keydown.arrowdown)="move(1, $event)" (keydown.arrowup)="move(-1, $event)"
          (keydown.enter)="runActive()" (keydown.escape)="closed.emit()">
        <div class="chlist palette-list" role="listbox" style="margin-top:8px">
          @for (c of matches(); track c.id; let i = $index) {
            <a role="option" [class.is-active]="i === active()" [attr.aria-selected]="i === active()" (click)="run(c)" (mouseenter)="active.set(i)">
              <b>{{ c.label }}</b><span>{{ c.hint }}</span></a>
          } @empty {
            <p class="mute">Nothing matches.</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class Palette {
  private readonly nav = inject(Nav);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('query');
  readonly closed = output<void>();
  readonly text = signal('');
  readonly active = signal(0);

  private readonly commands: Command[] = [
    ...TABS.map((t) => ({ id: t.id, label: t.label, hint: `g ${t.key}`, run: () => this.go(t.id) })),
    ...EXTRA_SCREENS.map((s) => ({ id: s.id, label: s.label, hint: 'screen', run: () => this.go(s.id) })),
  ];
  readonly matches = computed(() => {
    const q = this.text().trim().toLowerCase();
    return q ? this.commands.filter((c) => c.label.toLowerCase().includes(q)) : this.commands;
  });

  constructor() {
    afterNextRender(() => this.input().nativeElement.focus());
  }

  move(delta: number, event: Event) {
    event.preventDefault();
    const n = this.matches().length;
    if (n) this.active.update((i) => (i + delta + n) % n);
  }

  runActive() {
    const c = this.matches()[this.active()];
    if (c) this.run(c);
  }

  run(c: Command) {
    c.run();
  }

  private go(id: ScreenId) {
    this.nav.go(id);
    this.closed.emit();
  }
}
