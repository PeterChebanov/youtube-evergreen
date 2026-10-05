import { describe, expect, it } from 'vitest';
import { applyTableLayout, moveColumn } from './database-layout';

describe('applyTableLayout', () => {
  const columns = [
    { name: 'id', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'views_at_research', type: 'integer' },
  ];

  it('reorders and overrides widths', () => {
    const views = applyTableLayout(columns, { order: ['title', 'id', 'views_at_research'], widths: { title: 400 } });
    expect(views.map((v) => v.name)).toEqual(['title', 'id', 'views_at_research']);
    expect(views[0].width).toBe(400);
  });
});

describe('moveColumn', () => {
  it('moves an item in the list', () => {
    expect(moveColumn(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
});
