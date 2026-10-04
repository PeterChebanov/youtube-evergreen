import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Median views per channel over all of its stored videos. */
  async channelMedians(channelIds?: string[]): Promise<Map<string, number>> {
    if (channelIds && !channelIds.length) return new Map();
    const filter = channelIds ? Prisma.sql`WHERE channel_id IN (${Prisma.join(channelIds)})` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<Array<{ channel_id: string; median: number }>>`
      SELECT channel_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY views_at_research)::float8 AS median
      FROM videos ${filter} GROUP BY channel_id`;
    return new Map(rows.map((r) => [r.channel_id, Number(r.median)]));
  }
}
