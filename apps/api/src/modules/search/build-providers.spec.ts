import { activeSearchProviders } from './build-providers';
import { MockSearchProvider, TavilySearchProvider } from './providers';

describe('activeSearchProviders', () => {
  const tavily = new TavilySearchProvider('key');
  const mock = new MockSearchProvider();

  it('uses all configured providers when selection is empty', () => {
    expect(activeSearchProviders([tavily], []).map((p) => p.name)).toEqual(['tavily']);
  });

  it('filters to the selected ids', () => {
    expect(activeSearchProviders([tavily, mock], ['tavily']).map((p) => p.name)).toEqual(['tavily']);
  });

  it('falls back to mock when nothing is configured', () => {
    expect(activeSearchProviders([], []).map((p) => p.name)).toEqual(['mock']);
  });
});
