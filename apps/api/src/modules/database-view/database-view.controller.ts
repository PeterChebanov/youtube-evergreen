import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodPipe } from '../../common/zod';
import { DatabaseViewService } from './database-view.service';
import type { TableQuery } from './table-query';

const querySchema = z
  .object({
    sort: z.string().optional(),
    dir: z.enum(['asc', 'desc']).optional(),
    q: z.string().optional(),
    limit: z.coerce.number().int().optional(),
    offset: z.coerce.number().int().optional(),
  })
  .passthrough()
  .transform(({ sort, dir, q, limit, offset, ...rest }): TableQuery => ({
    sort,
    dir,
    q,
    limit,
    offset,
    eq: Object.fromEntries(
      Object.entries(rest)
        .filter(([k, v]) => k.startsWith('eq.') && typeof v === 'string')
        .map(([k, v]) => [k.slice(3), v as string]),
    ),
  }));

/** Read-only view of every table, exactly as stored (Database tab). */
@ApiTags('database')
@Controller('database')
export class DatabaseViewController {
  constructor(private readonly db: DatabaseViewService) {}

  @Get('tables')
  tables() {
    return this.db.tables();
  }

  @Get('tables/:table')
  @ApiQuery({ name: 'eq.<column>', required: false, description: 'Exact filter on a column, e.g. eq.channel_id=…' })
  rows(@Param('table') table: string, @Query(new ZodPipe(querySchema)) query: TableQuery) {
    return this.db.rows(table, query);
  }

  @Get('tables/:table/export')
  @Header('content-type', 'text/tab-separated-values; charset=utf-8')
  export(@Param('table') table: string, @Query(new ZodPipe(querySchema)) query: TableQuery) {
    return this.db.exportTsv(table, query);
  }
}
