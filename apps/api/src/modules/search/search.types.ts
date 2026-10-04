export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  /** Mock hits carry their text and must not be fetched over the network. */
  offline?: boolean;
};

export interface SearchProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<SearchHit[]>;
}
