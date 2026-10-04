import type { SearchHit, SearchProvider } from './search.types';

const TIMEOUT_MS = 15000;

async function json<T>(res: Response, provider: string): Promise<T> {
  if (!res.ok) throw new Error(`${provider} search failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily';
  constructor(private readonly apiKey: string) {}

  async search(query: string, limit: number): Promise<SearchHit[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, max_results: limit, search_depth: 'advanced', include_raw_content: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await json<{ results?: Array<{ title: string; url: string; content: string }> }>(res, this.name);
    return (body.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, provider: this.name }));
  }
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';
  constructor(private readonly apiKey: string) {}

  async search(query: string, limit: number): Promise<SearchHit[]> {
    const url = `https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: query, count: String(limit) })}`;
    const res = await fetch(url, {
      headers: { accept: 'application/json', 'x-subscription-token': this.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await json<{ web?: { results?: Array<{ title: string; url: string; description?: string }> } }>(res, this.name);
    return (body.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.description ?? '').replace(/<[^>]+>/g, ''),
      provider: this.name,
    }));
  }
}

export class PerplexitySearchProvider implements SearchProvider {
  readonly name = 'perplexity';
  constructor(private readonly apiKey: string) {}

  async search(query: string, limit: number): Promise<SearchHit[]> {
    const res = await fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, max_results: Math.min(20, Math.max(1, limit)) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await json<{ results?: Array<{ title: string; url: string; snippet?: string }> }>(res, this.name);
    return (body.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet ?? '',
      provider: this.name,
    }));
  }
}

/** Reddit threads give first-hand accounts and anecdotes (REQUIREMENTS 4.3). */
export class RedditSearchProvider implements SearchProvider {
  readonly name = 'reddit';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async search(query: string, limit: number): Promise<SearchHit[]> {
    const url = `https://oauth.reddit.com/search?${new URLSearchParams({ q: query, limit: String(limit), sort: 'relevance', type: 'link' })}`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'user-agent': 'youtube-ai-tool/0.1' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await json<{ data?: { children?: Array<{ data: { title: string; permalink: string; selftext?: string } }> } }>(res, this.name);
    return (body.data?.children ?? []).map(({ data }) => ({
      title: data.title,
      url: `https://www.reddit.com${data.permalink}`,
      snippet: (data.selftext ?? '').slice(0, 1500),
      provider: this.name,
    }));
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'youtube-ai-tool/0.1',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await json<{ access_token: string; expires_in: number }>(res, this.name);
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }
}

/** Offline provider used when no search key is configured. */
export class MockSearchProvider implements SearchProvider {
  readonly name = 'mock';

  async search(query: string, limit: number): Promise<SearchHit[]> {
    const slug = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'topic';
    return Array.from({ length: Math.min(limit, 2) }, (_, i) => ({
      title: `${query} — source ${i + 1}`,
      url: `https://example.org/${slug}/${i + 1}`,
      snippet: `Archive records about ${query} show a detail most retellings skip (source ${i + 1}). Eyewitnesses later disagreed about the timeline.`,
      provider: this.name,
      offline: true,
    }));
  }
}
