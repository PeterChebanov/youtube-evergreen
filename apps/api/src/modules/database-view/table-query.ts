import { invalid } from '../../common/domain-error';

export const BROWSABLE_TABLES = [
  'channels',
  'videos',
  'chapters',
  'subsections',
  'research_snapshots',
  'video_analyses',
  'author_styles',
  'genres',
  'channel_styles',
  'projects',
  'advice_runs',
  'plan_versions',
  'research_facts',
  'script_chapters',
  'my_videos',
  'research_jobs',
  'job_records',
  'llm_calls',
  'api_quota_usage',
] as const;
export type BrowsableTable = (typeof BROWSABLE_TABLES)[number];

export type ColumnInfo = { name: string; type: string };

export type TableQuery = {
  sort?: string;
  dir?: 'asc' | 'desc';
  q?: string;
  eq?: Record<string, string>;
  limit?: number;
  offset?: number;
};

export const MAX_PAGE = 500;
export const MAX_EXPORT = 100_000;

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const isVector = (c: ColumnInfo) => c.type === 'vector';

export function assertTable(table: string): BrowsableTable {
  if (!(BROWSABLE_TABLES as readonly string[]).includes(table)) throw invalid(`Unknown table ${table}`);
  return table as BrowsableTable;
}

/**
 * Read-only SELECT over a whitelisted table. Identifiers come only from the
 * table's real column list; every user value is a bound parameter. Cells are
 * returned as their PostgreSQL text form; vectors are summarised.
 */
export function buildTableQuery(table: BrowsableTable, columns: ColumnInfo[], query: TableQuery, { exporting = false } = {}) {
  const known = new Map(columns.map((c) => [c.name, c]));
  const params: unknown[] = [];
  const param = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const select = columns
    .map((c) =>
      isVector(c)
        ? `CASE WHEN ${ident(c.name)} IS NULL THEN NULL ELSE 'vector(' || vector_dims(${ident(c.name)}) || ')' END AS ${ident(c.name)}`
        : `${ident(c.name)}::text AS ${ident(c.name)}`,
    )
    .join(', ');

  const where: string[] = [];
  if (query.q?.trim()) {
    const p = param(`%${query.q.trim()}%`);
    const searchable = columns.filter((c) => !isVector(c));
    where.push(`(${searchable.map((c) => `${ident(c.name)}::text ILIKE ${p}`).join(' OR ')})`);
  }
  for (const [name, value] of Object.entries(query.eq ?? {})) {
    if (!known.has(name)) throw invalid(`Unknown column ${name}`);
    where.push(`${ident(name)}::text = ${param(value)}`);
  }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  let order = '';
  if (query.sort) {
    const col = known.get(query.sort);
    if (!col || isVector(col)) throw invalid(`Cannot sort by ${query.sort}`);
    // Qualified so the stored type is sorted, not the ::text output alias of the same name.
    order = ` ORDER BY ${ident(table)}.${ident(col.name)} ${query.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`;
  } else if (known.has('id')) {
    order = ` ORDER BY ${ident(table)}."id" ASC`;
  }

  const limit = exporting ? MAX_EXPORT : Math.min(Math.max(query.limit ?? 100, 1), MAX_PAGE);
  const offset = exporting ? 0 : Math.max(query.offset ?? 0, 0);
  const countParams = [...params];
  return {
    rows: { sql: `SELECT ${select} FROM ${ident(table)}${whereSql}${order} LIMIT ${param(limit)} OFFSET ${param(offset)}`, params },
    count: { sql: `SELECT count(*)::int AS total FROM ${ident(table)}${whereSql}`, params: countParams },
  };
}

/** Tab-separated export; tabs and line breaks inside cells become spaces so rows stay intact. */
export function toTsv(columns: string[], rows: Array<Record<string, string | null>>): string {
  const cell = (v: string | null | undefined) => (v ?? '').replace(/[\t\r\n]+/g, ' ');
  return [columns.join('\t'), ...rows.map((r) => columns.map((c) => cell(r[c])).join('\t'))].join('\n');
}
