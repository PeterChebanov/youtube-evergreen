import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Api, errorText } from './api.service';
import type { OpsStatus, ProjectDto } from './api.types';
import { STATUS_POLL_MS } from './config';
import { ScreenId, screenFromHash } from './screens';

/** Runs `tick` now and every `ms` until the owner is destroyed. */
export function poll(destroyRef: DestroyRef, ms: number, tick: () => unknown) {
  void tick();
  const id = setInterval(() => void tick(), ms);
  destroyRef.onDestroy(() => clearInterval(id));
}

@Injectable({ providedIn: 'root' })
export class Nav {
  readonly screen = signal<ScreenId>(screenFromHash(location.hash));

  constructor() {
    window.addEventListener('hashchange', () => this.screen.set(screenFromHash(location.hash)));
  }

  go(id: ScreenId) {
    this.screen.set(id);
    if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class StatusStore {
  private readonly api = inject(Api);
  readonly status = signal<OpsStatus | null>(null);
  readonly reachable = signal(true);

  start(destroyRef: DestroyRef) {
    poll(destroyRef, STATUS_POLL_MS, () => this.refresh());
  }

  async refresh() {
    try {
      this.status.set(await this.api.opsStatus());
      this.reachable.set(true);
    } catch {
      this.reachable.set(false);
    }
  }
}

const PROJECT_KEY = 'evergreen.projectId';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly api = inject(Api);
  readonly projects = signal<ProjectDto[]>([]);
  readonly currentId = signal<string | null>(localStorage.getItem(PROJECT_KEY));
  readonly error = signal<string | null>(null);
  readonly current = computed(() => this.projects().find((p) => p.id === this.currentId()) ?? null);

  async refresh() {
    try {
      this.projects.set(await this.api.projects());
      this.error.set(null);
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  select(id: string | null) {
    this.currentId.set(id);
    if (id) localStorage.setItem(PROJECT_KEY, id);
    else localStorage.removeItem(PROJECT_KEY);
  }

  /** Keeps the list in sync after an action returned a fresh project. */
  upsert(project: ProjectDto) {
    this.projects.update((list) =>
      list.some((p) => p.id === project.id) ? list.map((p) => (p.id === project.id ? project : p)) : [project, ...list],
    );
  }

  async reload(id: string) {
    this.upsert(await this.api.project(id));
  }
}
