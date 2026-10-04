import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorMessage } from '../../common/domain-error';
import type { AppConfig } from '../../config/app.config';
import { normalizeUrl } from '../fact-research/fact-policy';
import { activeSearchProviders, buildSearchProviders, searchOptions } from './build-providers';
import { htmlToText } from './html-text';
import { MockSearchProvider } from './providers';
import type { SearchHit, SearchProvider } from './search.types';

const PAGE_TEXT_LIMIT = 8000;

export type SourceDocument = { url: string; title: string; text: string };

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly providers: SearchProvider[];
  private readonly cfg: AppConfig['search'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.cfg = config.get('search', { infer: true });
    this.providers = buildSearchProviders(this.cfg);
  }

  get providerNames(): string[] {
    return this.active().map((p) => p.name);
  }

  options() {
    return searchOptions(this.cfg);
  }

  private active(selected: readonly string[] = []): SearchProvider[] {
    const active = activeSearchProviders(this.providers, selected);
    if (!active.length) {
      throw new Error('No search providers are selected. Pick at least one source with a configured API key.');
    }
    return active;
  }

  /** Queries every selected provider; one failing provider does not fail the search. */
  async search(queries: string[], selectedProviders: readonly string[] = []): Promise<SearchHit[]> {
    const providers = this.active(selectedProviders);
    const tasks = queries.flatMap((q) => providers.map((p) => p.search(q, this.cfg.resultsPerQuery)));
    const settled = await Promise.allSettled(tasks);
    const hits = new Map<string, SearchHit>();
    for (const s of settled) {
      if (s.status === 'rejected') {
        this.logger.warn(errorMessage(s.reason));
        continue;
      }
      for (const hit of s.value) {
        const key = normalizeUrl(hit.url);
        if (key && !hits.has(key)) hits.set(key, { ...hit, url: key });
      }
    }
    if (!hits.size && settled.every((s) => s.status === 'rejected')) {
      throw new Error('All search providers failed');
    }
    return [...hits.values()];
  }

  /** Search hits turned into source documents with page text where it can be fetched. */
  async documents(queries: string[], selectedProviders: readonly string[] = []): Promise<SourceDocument[]> {
    const hits = (await this.search(queries, selectedProviders)).slice(0, this.cfg.maxPagesPerChapter);
    return Promise.all(
      hits.map(async (h) => {
        const page = h.offline ? null : await this.fetchPage(h.url);
        return { url: h.url, title: page?.title || h.title, text: page?.text || h.snippet };
      }),
    );
  }

  private async fetchPage(url: string): Promise<{ title: string | null; text: string } | null> {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (research bot; youtube-ai-tool)', accept: 'text/html,text/plain' },
        signal: AbortSignal.timeout(this.cfg.fetchTimeoutMs),
        redirect: 'follow',
      });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !/text\/(html|plain)/.test(type)) return null;
      const body = await res.text();
      const page = type.includes('html') ? htmlToText(body) : { title: null, text: body };
      return { title: page.title, text: page.text.slice(0, PAGE_TEXT_LIMIT) };
    } catch {
      return null;
    }
  }
}
