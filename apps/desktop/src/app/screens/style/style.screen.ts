import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import type { ChannelStyle, Genre, LlmCatalog } from '../../core/api.types';
import { defaultVendorForStage, overridesForStage } from '../../core/llm-preferences';
import { LlmVendorSelect } from '../../ui/llm-vendor-select';
import { formatDate } from '../../core/format';
import { StatusStore } from '../../core/stores';
import { formatTechniques, parseTechniques } from './style.view';

@Component({
  selector: 'section[esStyle]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LlmVendorSelect],
  host: { class: 'screen', id: 'screen-style', 'data-screen': 'style' },
  templateUrl: './style.screen.html',
})
export class StyleScreen {
  private readonly api = inject(Api);
  readonly status = inject(StatusStore);

  readonly style = signal<ChannelStyle | null>(null);
  readonly voice = signal('');
  readonly themes = signal('');
  readonly techniques = signal('');
  readonly retention = signal('');
  readonly genres = signal<Genre[] | null>(null);
  readonly newName = signal('');
  readonly newFocus = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly catalog = signal<LlmCatalog | null>(null);
  readonly styleVendor = signal<string | null>(null);

  readonly versionMeta = computed(() => {
    const s = this.style();
    return s ? `version ${s.version} · ${formatDate(s.createdAt)}` : 'no version yet';
  });
  readonly canSave = computed(() => !!(this.voice().trim() && this.themes().trim() && this.retention().trim() && parseTechniques(this.techniques()).length));

  constructor() {
    void this.load();
    void this.api.llmCatalog().then((c) => {
      this.catalog.set(c);
      this.styleVendor.set(defaultVendorForStage('channel_style', c));
    });
  }

  async load() {
    try {
      const [style, genres] = await Promise.all([this.api.style(), this.api.genres()]);
      this.fill(style);
      this.genres.set(genres);
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  saveStyle() {
    return this.act(async () => {
      this.fill(
        await this.api.saveStyle({
          voice: this.voice().trim(),
          themes: this.themes().trim(),
          retentionRules: this.retention().trim(),
          techniques: parseTechniques(this.techniques()),
        }),
      );
      this.notice.set('Saved as a new version.');
    });
  }

  draft() {
    return this.act(async () => {
      this.fill(await this.api.draftStyle(overridesForStage('channel_style', this.styleVendor())));
      this.notice.set('Drafted from the author styles and saved as a new version. Edit and save again if needed.');
    });
  }

  addGenre() {
    const name = this.newName().trim();
    const focus = this.newFocus().trim();
    if (!name || !focus) return Promise.resolve();
    return this.act(async () => {
      await this.api.createGenre({ name, focus, status: 'approved' });
      this.newName.set('');
      this.newFocus.set('');
      this.genres.set(await this.api.genres());
    });
  }

  setGenreStatus(g: Genre, status: Genre['status']) {
    return this.act(async () => {
      await this.api.updateGenre(g.id, { status });
      this.genres.set(await this.api.genres());
    });
  }

  removeGenre(g: Genre) {
    return this.act(async () => {
      await this.api.deleteGenre(g.id);
      this.genres.set(await this.api.genres());
    });
  }

  recompute() {
    return this.act(async () => {
      const r = await this.api.recomputeGenres();
      this.notice.set(`Updated ${r.updated} genres${r.failed.length ? `; failed: ${r.failed.join(', ')}` : ''}.`);
      this.genres.set(await this.api.genres());
    });
  }

  private fill(style: ChannelStyle | null) {
    this.style.set(style);
    this.voice.set(style?.voice ?? '');
    this.themes.set(style?.themes ?? '');
    this.techniques.set(formatTechniques(style?.techniques ?? []));
    this.retention.set(style?.retentionRules ?? '');
    void this.status.refresh();
  }

  private async act(action: () => Promise<unknown>) {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
