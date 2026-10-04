import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { channelUrl, extractYoutubeVideoId } from '@youtube-ai-tool/shared';
import { Api, errorText } from '../../core/api.service';
import type { SubtitleCheck } from '../../core/api.types';
import { clock } from '../../core/format';
import { Nav, ProjectStore } from '../../core/stores';
import { channelLine, scenarioView, toneRows } from './subtitles.view';

const MAX_TONE_REFERENCES = 3;

@Component({
  selector: 'section[esSubtitles]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'screen', id: 'screen-subtitles', 'data-screen': 'subtitles' },
  templateUrl: './subtitles.screen.html',
})
export class SubtitlesScreen {
  private readonly api = inject(Api);
  private readonly nav = inject(Nav);
  readonly projects = inject(ProjectStore);

  readonly url = signal('');
  readonly urlError = signal<string | null>(null);
  readonly check = signal<SubtitleCheck | null>(null);
  readonly checkedUrl = signal('');
  readonly busy = signal<'check' | 'fetch' | 'analyze' | null>(null);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly view = computed(() => (this.check() ? scenarioView(this.check()!) : null));
  readonly channel = computed(() => (this.check() ? channelLine(this.check()!) : ''));
  readonly length = computed(() => clock(this.check()?.durationSec ?? 0));
  readonly tone = computed(() => toneRows(this.check()?.transcriptAnalysis ?? null));
  readonly hasTranscript = computed(() => this.check()?.transcriptStatus === 'done');
  readonly inWriter = computed(() => {
    const id = this.check()?.videoId;
    return !!id && !!this.projects.current()?.toneReferenceVideoIds.includes(id);
  });

  async runCheck() {
    const url = this.url().trim();
    if (!extractYoutubeVideoId(url)) return this.urlError.set('Paste a YouTube video URL such as https://www.youtube.com/watch?v=…');
    this.urlError.set(null);
    await this.act('check', async () => {
      this.check.set(await this.api.checkSubtitles(url));
      this.checkedUrl.set(url);
    });
  }

  async fetch() {
    const view = this.view();
    if (!view) return;
    await this.act('fetch', async () => {
      const result = await this.api.fetchSubtitles({
        url: this.checkedUrl(),
        confirmTitleMismatch: view.primary.confirm === 'title',
        confirmAddVideo: view.primary.confirm === 'add',
        confirmOverwrite: view.primary.confirm === 'overwrite',
      });
      this.check.set(result.check);
      if (result.outcome === 'confirmation_required') return this.notice.set(result.confirmation);
      if (result.outcome === 'unavailable') return this.notice.set('YouTube has no subtitles for this video. Nothing was analyzed.');
      if (result.check.videoId) {
        await this.api.analyzeTranscript(result.check.videoId);
        this.check.set(await this.api.checkSubtitles(this.checkedUrl()));
      }
      this.notice.set('Subtitles saved and analyzed.');
    });
  }

  async analyze() {
    const id = this.check()?.videoId;
    if (!id) return;
    await this.act('analyze', async () => {
      await this.api.analyzeTranscript(id);
      this.check.set(await this.api.checkSubtitles(this.checkedUrl()));
    });
  }

  async researchChannel() {
    const c = this.check();
    if (!c) return;
    await this.act('fetch', async () => {
      await this.api.startResearch(channelUrl(c.youtubeChannelId));
      this.nav.go('research');
    });
  }

  async useInWriter() {
    const p = this.projects.current();
    const id = this.check()?.videoId;
    if (!p || !id) return;
    const ids = this.inWriter() ? p.toneReferenceVideoIds.filter((x) => x !== id) : [...p.toneReferenceVideoIds, id].slice(-MAX_TONE_REFERENCES);
    await this.act('analyze', async () => this.projects.upsert(await this.api.updateProject(p.id, { toneReferenceVideoIds: ids })));
  }

  private async act(kind: 'check' | 'fetch' | 'analyze', action: () => Promise<unknown>) {
    this.busy.set(kind);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(null);
    }
  }
}
