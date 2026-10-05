import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { parseChannelRef, todayIsoDateUtc } from '@youtube-ai-tool/shared';
import { Api, errorText } from '../../core/api.service';
import type { ChannelDetail, ChannelSummary, LlmCatalog } from '../../core/api.types';
import { channelResearchOverrides, defaultVendorForStage } from '../../core/llm-preferences';
import { LlmVendorSelect } from '../../ui/llm-vendor-select';
import { JOB_POLL_MS } from '../../core/config';
import { formatCompact, formatUsd, plural } from '../../core/format';
import { poll } from '../../core/stores';
import { Dialogs } from '../../ui/dialog';
import { channelRow, channelsMeta, jobLog } from './research.view';

@Component({
  selector: 'section[esResearch]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LlmVendorSelect],
  host: { class: 'screen', id: 'screen-research', 'data-screen': 'research' },
  templateUrl: './research.screen.html',
})
export class ResearchScreen {
  private readonly api = inject(Api);
  private readonly dialogs = inject(Dialogs);

  readonly catalog = signal<LlmCatalog | null>(null);
  readonly analysisVendor = signal<string | null>(null);
  readonly url = signal('');
  readonly periodFrom = signal<string | null>(null);
  readonly periodTo = signal(todayIsoDateUtc());
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
    void this.api.llmCatalog().then((c) => {
      this.catalog.set(c);
      this.analysisVendor.set(defaultVendorForStage('video_basic', c));
    });
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

  researchAll() {
    void this.runResearch({});
  }

  researchPeriod() {
    const from = this.periodFrom()?.trim();
    const to = this.periodTo()?.trim();
    if (!from) {
      this.urlError.set('Pick a start date, or use Research all period.');
      return;
    }
    if (!to) {
      this.urlError.set('Pick an end date.');
      return;
    }
    if (from > to) {
      this.urlError.set('Start date must be on or before end date.');
      return;
    }
    void this.runResearch({ publishedAfter: from, publishedBefore: to });
  }

  private async runResearch(period: { publishedAfter?: string; publishedBefore?: string }) {
    const url = this.url().trim();
    if (!parseChannelRef(url)) {
      this.urlError.set('Paste a channel URL such as https://www.youtube.com/@handle or /channel/UC…');
      return;
    }
    this.urlError.set(null);
    this.busy.set(true);
    try {
      const body = {
        channelUrl: url,
        ...period,
        llmModelOverrides: channelResearchOverrides(this.analysisVendor()),
      };
      const p = await this.api.researchPreview(body);
      const scoped = period.publishedAfter || period.publishedBefore;
      const ok = await this.dialogs.confirm({
        title: `Research ${p.channelName}`,
        rows: [
          { label: 'On YouTube (all time)', value: plural(p.videoCount, 'video') },
          ...(scoped
            ? [{ label: 'In selected period', value: plural(p.inPeriodVideoCount ?? p.estimate.videoCount, 'video') }]
            : []),
          { label: 'Stored in library', value: plural(p.storedVideos, 'video') },
          { label: 'To analyze', value: plural(p.estimate.videoCount, 'video') },
          { label: 'LLM cost', value: `about ${formatUsd(p.estimate.estimatedUsd)}` },
          ...(period.publishedAfter ? [{ label: 'From', value: period.publishedAfter }] : []),
          ...(period.publishedBefore ? [{ label: 'To', value: period.publishedBefore }] : []),
        ],
        warning: p.inLibrary ? 'Videos outside the period are skipped. Already stored in-range videos get a view snapshot.' : undefined,
        confirmLabel: 'Start research',
      });
      if (!ok) return;
      const started = await this.api.startResearch(body);
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
    await this.act(() => this.api.rerunChannel(channelId, channelResearchOverrides(this.analysisVendor())));
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
