import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import type { MyVideoItem, TopicMemory } from '../../core/api.types';
import { fileSlug, saveText } from '../../core/download';
import { ProjectStore } from '../../core/stores';
import { WorkspaceStore, type WorkspaceScriptDetail } from '../../core/workspace.store';
import { ProjectTag } from '../../ui/project-tag';
import { scriptRows } from './videos.view';

@Component({
  selector: 'section[esVideos]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectTag],
  host: { class: 'screen', id: 'screen-videos', 'data-screen': 'videos' },
  templateUrl: './videos.screen.html',
})
export class VideosScreen {
  private readonly api = inject(Api);
  private readonly projects = inject(ProjectStore);
  private readonly workspace = inject(WorkspaceStore);

  readonly videos = signal<MyVideoItem[] | null>(null);
  readonly scriptPreview = signal<WorkspaceScriptDetail | null>(null);
  readonly previewError = signal<string | null>(null);
  readonly memory = signal<TopicMemory | null>(null);
  readonly selectedKey = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly rows = computed(() => scriptRows(this.videos() ?? [], this.projects.projects()));
  readonly selected = computed(() => this.rows().find((r) => r.key === this.selectedKey()) ?? this.rows().at(0) ?? null);
  readonly meta = computed(() => {
    const done = this.rows().filter((r) => r.finished).length;
    const drafts = this.rows().length - done;
    return `${done} finished · ${drafts} ${drafts === 1 ? 'draft' : 'drafts'}`;
  });

  constructor() {
    void this.load();
    effect(() => {
      const row = this.selected();
      untracked(() => {
        this.scriptPreview.set(null);
        this.previewError.set(null);
        if (!row) return;
        void this.workspace
          .scriptDetail(row.projectId)
          .then((d) => this.scriptPreview.set(d))
          .catch((e) => this.previewError.set(errorText(e)));
      });
    });
  }

  async load() {
    try {
      const [videos, memory] = await Promise.all([this.api.myVideos(), this.api.topicMemory(), this.projects.refresh()]);
      this.videos.set(videos);
      this.memory.set(memory);
    } catch (e) {
      this.error.set(errorText(e));
      this.videos.set([]);
    }
  }

  async exportSelected() {
    const row = this.selected();
    if (!row) return;
    try {
      saveText(`${fileSlug(row.title)}.md`, await this.api.exportScript(row.projectId));
    } catch (e) {
      this.error.set(errorText(e));
    }
  }
}
