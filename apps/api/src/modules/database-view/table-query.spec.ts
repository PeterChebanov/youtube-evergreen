import { DomainError } from '../../common/domain-error';
import { assertTable, buildTableQuery, MAX_PAGE, toTsv } from './table-query';

const columns = [
  { name: 'id', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'views_at_research', type: 'integer' },
  { name: 'embedding', type: 'vector' },
];

describe('buildTableQuery', () => {
  it('selects every stored column as text and summarises vectors', () => {
    const { rows } = buildTableQuery('videos', columns, {});
    expect(rows.sql).toContain('"title"::text AS "title"');
    expect(rows.sql).toContain(`'vector(' || vector_dims("embedding") || ')'`);
    expect(rows.sql).toContain('ORDER BY "videos"."id" ASC');
  });

  it('binds search text and filters as parameters, never inline', () => {
    const { rows, count } = buildTableQuery('videos', columns, { q: "o'brien", eq: { id: 'v1' }, limit: 10, offset: 20 });
    expect(rows.sql).not.toContain("o'brien");
    expect(rows.params).toEqual(["%o'brien%", 'v1', 10, 20]);
    expect(count.params).toEqual(["%o'brien%", 'v1']);
    expect(rows.sql).not.toContain('"embedding"::text ILIKE');
  });

  it('sorts by the stored column, not its text projection', () => {
    expect(buildTableQuery('videos', columns, { sort: 'views_at_research', dir: 'desc' }).rows.sql).toContain(
      'ORDER BY "videos"."views_at_research" DESC NULLS LAST',
    );
    expect(() => buildTableQuery('videos', columns, { sort: 'title; DROP TABLE videos' })).toThrow(DomainError);
    expect(() => buildTableQuery('videos', columns, { eq: { nope: 'x' } })).toThrow(DomainError);
  });

  it('caps page size', () => {
    expect(buildTableQuery('videos', columns, { limit: 10_000 }).rows.params).toEqual([MAX_PAGE, 0]);
  });

  it('only exposes whitelisted tables', () => {
    expect(assertTable('videos')).toBe('videos');
    expect(() => assertTable('pg_user')).toThrow(DomainError);
  });
});

describe('toTsv', () => {
  it('keeps one line per row even when cells contain tabs or newlines', () => {
    expect(toTsv(['a', 'b'], [{ a: 'x\ty', b: 'line1\nline2' }, { a: null, b: '2' }])).toBe('a\tb\nx y\tline1 line2\n\t2');
  });
});
