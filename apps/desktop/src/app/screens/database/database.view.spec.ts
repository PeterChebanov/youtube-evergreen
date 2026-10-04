import { describe, expect, it } from 'vitest';
import { TABLE_MIN, columnViews, pagesFor, tableWidth, toTsv, visibleRange } from './database.view';

describe('columnViews', () => {
  const views = columnViews([
    { name: 'id', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'views_at_research', type: 'integer' },
    { name: 'published_at', type: 'timestamp without time zone' },
    { name: 'summary', type: 'text' },
  ]);

  it('lets one long text column take the free width and sizes the rest by type', () => {
    expect(views.map((v) => v.width)).toEqual([130, null, 110, 176, 200]);
  });

  it('right-aligns numbers', () => {
    expect(views.filter((v) => v.right).map((v) => v.name)).toEqual(['views_at_research']);
  });

  it('never makes the table narrower than the minimum', () => {
    expect(tableWidth(views)).toBe(TABLE_MIN);
    expect(tableWidth([...views, ...views])).toBe(2 * (130 + 240 + 110 + 176 + 200));
  });
});

describe('virtual rows', () => {
  it('renders the visible rows plus the overscan', () => {
    expect(visibleRange(0, 300, 30, 14382)).toEqual({ start: 0, end: 22 });
    expect(visibleRange(3000, 300, 30, 14382)).toEqual({ start: 88, end: 122 });
  });

  it('stops at the last row', () => {
    expect(visibleRange(1000, 300, 30, 20)).toEqual({ start: 21, end: 21 });
  });

  it('loads every page the range touches', () => {
    expect(pagesFor(190, 230, 200)).toEqual([0, 1]);
    expect(pagesFor(0, 200, 200)).toEqual([0]);
    expect(pagesFor(5, 5, 200)).toEqual([]);
  });
});

it('copies rows as TSV without breaking lines inside cells', () => {
  expect(toTsv(['id', 'title'], [{ id: '1', title: 'a\tb\nc' }, { id: '2', title: null }])).toBe('id\ttitle\n1\ta b c\n2\t');
});
