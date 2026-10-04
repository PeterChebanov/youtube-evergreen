import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { parseChannelRef } from '@youtube-ai-tool/shared';
import { Api, errorText } from '../../core/api.service';
import type { ChannelDetail, ChannelSummary } from '../../core/api.types';
import { JOB_POLL_MS } from '../../core/config';
import { formatCompact, formatUsd, plural } from '../../core/format';
import { poll } from '../../core/stores';
import { Dialogs } from '../../ui/dialog';
import { channelRow, channelsMeta, jobLog } from './research.view';

@Component({
  selector: 'section[esResearch]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'screen', id: 'screen-research', 'data-screen': 'research' },
  templateUrl: './research.screen.html',
})
export class ResearchScreen {
  private readonly api = inject(Api);
  private readonly dialogs = inject(Dialogs);

  readonly url = signal('');
  readonly urlError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly banner = signal<string | null>(null);
  readonly channels = signal<ChannelSummary[] | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<ChannelDetail | null>(null);
  private readonly now = signal(new Date());

  readonly rows = computed(() => (this.channels() ?? []).map((c) => ({ channel: c, view: channelRow(c, this.now()) })));
  readonly meta = computed(() => channelsMeta(this.channels() ?? [], this.now()));
  readonly selected = computed(() => this.channels()?.find((c) => c.id === this.selectedId()) ?? this.channels()?.at(0) ?? null);
  readonly log = computed(() => (this.selected() ? jobLog(this.selected()!) : []));
  readonly stats = computed(() => {
    const s = this.detail()?.stats;
    if (!s) return null;
    return [
      { n: s.videoCount.toLocaleString('en-US'), l: 'Long-form videos' },
      { n: formatCompact(s.medianViews), l: 'Median views' },
      { n: `${Math.round(s.averageDurationSec / 60)} min`, l: 'Average length' },
      { n: String(Math.round(s.chaptersPerVideo * 10) / 10), l: 'Chapters per video' },
    ];
  });

  constructor() {
    poll(inject(DestroyRef), JOB_POLL_MS, () => this.load());
    let lastKey = '';
    effect(() => {
      const c = this.selected();
      const key = c ? `${c.id}:${c.researchStatus}:${c.job?.stage}:${c.analyzedCount}` : '';
      if (key === lastKey) return;
      lastKey = key;
      if (c) void this.loadDetail(c.id);
      else this.detail.set(null);
    });
  }

  async load() {
    try {
      this.channels.set(await this.api.channels());
      this.now.set(new Date());
    } catch (e) {
      this.banner.set(errorText(e));
    }
  }

  private async loadDetail(id: string) {
    try {
      const d = await this.api.channel(id);
      if (this.selected()?.id === id) this.detail.set(d);
    } catch {
      this.detail.set(null);
    }
  }

  async addChannel() {
    const url = this.url().trim();
    if (!parseChannelRef(url)) {
      this.urlError.set('Paste a channel URL such as https://www.youtube.com/@handle or /channel/UC…');
      return;
    }
    this.urlError.set(null);
    this.busy.set(true);
    try {
      const p = await this.api.researchPreview(url);
      const ok = await this.dialogs.confirm({
        title: `Research ${p.channelName}`,
        rows: [
          { label: 'On YouTube', value: plural(p.videoCount, 'video') },
          { label: 'Stored', value: plural(p.storedVideos, 'video') },
          { label: 'To analyze', value: plural(p.estimate.videoCount, 'video') },
          { label: 'LLM cost', value: `about ${formatUsd(p.estimate.estimatedUsd)}` },
        ],
        warning: p.inLibrary ? 'This channel is already in the library. New videos are added and view counts get a new snapshot.' : undefined,
        confirmLabel: 'Start research',
      });
      if (!ok) return;
      const started = await this.api.startResearch(url);
      this.url.set('');
      this.selectedId.set(started.id);
      await this.load();
    } catch (e) {
      this.urlError.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  async retry(jobId: string, event: Event) {
    event.stopPropagation();
    await this.act(() => this.api.retryResearch(jobId));
  }

  async rerun(channelId: string) {
    await this.act(() => this.api.rerunChannel(channelId));
  }

  async refreshViews() {
    await this.act(async () => {
      const { queued } = await this.api.refreshViews();
      this.banner.set(queued ? `Refreshing views for ${plural(queued, 'channel')}.` : 'No ready channels to refresh.');
    });
  }

  private async act(action: () => Promise<unknown>) {
    this.banner.set(null);
    try {
      await action();
      await this.load();
    } catch (e) {
      this.banner.set(errorText(e));
    }
  }
}
