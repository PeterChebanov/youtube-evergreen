import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTable, BROWSABLE_TABLES, buildTableQuery, ColumnInfo, TableQuery, toTsv } from './table-query';

type Row = Record<string, string | null>;

@Injectable()
export class DatabaseViewService {
  constructor(private readonly prisma: PrismaService) {}

  async tables() {
    const counts = await this.prisma.$queryRaw<Array<{ relname: string; n: number }>>`
      SELECT relname, n_live_tup::int AS n FROM pg_stat_user_tables`;
    const byName = new Map(counts.map((c) => [c.relname, c.n]));
    return BROWSABLE_TABLES.map((name) => ({ name, approxRows: byName.get(name) ?? 0 }));
  }

  async rows(table: string, query: TableQuery) {
    const t = assertTable(table);
    const columns = await this.columns(t);
    const q = buildTableQuery(t, columns, query);
    const [rows, count] = await Promise.all([
      this.prisma.$queryRawUnsafe<Row[]>(q.rows.sql, ...q.rows.params),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(q.count.sql, ...q.count.params),
    ]);
    return { table: t, columns, rows, total: count[0]?.total ?? 0 };
  }

  async exportTsv(table: string, query: TableQuery): Promise<string> {
    const t = assertTable(table);
    const columns = await this.columns(t);
    const q = buildTableQuery(t, columns, query, { exporting: true });
    const rows = await this.prisma.$queryRawUnsafe<Row[]>(q.rows.sql, ...q.rows.params);
    return toTsv(columns.map((c) => c.name), rows);
  }

  private async columns(table: string): Promise<ColumnInfo[]> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; type: string; udt: string }>>`
      SELECT column_name AS name, data_type AS type, udt_name AS udt
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${table}
      ORDER BY ordinal_position`;
    return rows.map((r) => ({ name: r.name, type: r.udt === 'vector' ? 'vector' : r.type }));
  }
}
