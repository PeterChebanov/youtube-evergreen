import { cosineSimilarity } from '../../common/vector';
import { EMBEDDING_DIM } from './llm.types';
import { mockEmbedding } from './mock-embedding';

describe('mockEmbedding', () => {
  it('produces unit vectors of the database dimension', () => {
    const v = mockEmbedding('Fall of the Soviet Union');
    expect(v).toHaveLength(EMBEDDING_DIM);
    expect(Math.hypot(...v)).toBeCloseTo(1);
  });

  it('is deterministic and case-insensitive', () => {
    expect(mockEmbedding('Chernobyl disaster')).toEqual(mockEmbedding('CHERNOBYL Disaster'));
  });

  it('ranks texts sharing words above unrelated texts', () => {
    const base = mockEmbedding('the last days of the soviet union');
    const close = mockEmbedding('why the soviet union collapsed in its last days');
    const far = mockEmbedding('how octopuses change colour underwater');
    expect(cosineSimilarity(base, close)).toBeGreaterThan(cosineSimilarity(base, far) + 0.3);
  });

  it('still returns a usable vector for text without words', () => {
    expect(Math.hypot(...mockEmbedding('!!'))).toBeCloseTo(1);
  });
});
