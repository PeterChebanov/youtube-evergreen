import type { SearchProviderId } from '@youtube-ai-tool/shared';
import { SEARCH_PROVIDER_IDS, SEARCH_PROVIDER_LABELS } from '@youtube-ai-tool/shared';
import type { AppConfig } from '../../config/app.config';
import {
  BraveSearchProvider,
  MockSearchProvider,
  PerplexitySearchProvider,
  RedditSearchProvider,
  TavilySearchProvider,
} from './providers';
import type { SearchProvider } from './search.types';

export function buildSearchProviders(cfg: AppConfig['search']): SearchProvider[] {
  const providers: SearchProvider[] = [];
  if (cfg.tavilyApiKey) providers.push(new TavilySearchProvider(cfg.tavilyApiKey));
  if (cfg.braveApiKey) providers.push(new BraveSearchProvider(cfg.braveApiKey));
  if (cfg.perplexityApiKey) providers.push(new PerplexitySearchProvider(cfg.perplexityApiKey));
  if (cfg.redditClientId && cfg.redditClientSecret) {
    providers.push(new RedditSearchProvider(cfg.redditClientId, cfg.redditClientSecret));
  }
  return providers;
}

export function searchOptions(cfg: AppConfig['search']) {
  const configured = new Set(buildSearchProviders(cfg).map((p) => p.name));
  return SEARCH_PROVIDER_IDS.map((id) => ({
    id,
    label: SEARCH_PROVIDER_LABELS[id],
    configured: configured.has(id),
  }));
}

/** Empty `selected` means all configured providers; otherwise only the intersection. */
export function activeSearchProviders(all: SearchProvider[], selected: readonly string[]): SearchProvider[] {
  const configured = all.length ? all : [new MockSearchProvider()];
  if (!selected.length) return configured;
  const want = new Set(selected);
  return configured.filter((p) => want.has(p.name));
}

export function parseSearchProviderIds(values: string[]): SearchProviderId[] {
  const allowed = new Set<string>(SEARCH_PROVIDER_IDS);
  return values.filter((v): v is SearchProviderId => allowed.has(v));
}
