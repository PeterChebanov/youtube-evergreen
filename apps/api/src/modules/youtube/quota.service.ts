import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { nextQuotaReset, quotaDay, QuotaExceededError } from './quota';

@Injectable()
export class QuotaService {
  private readonly limit: number;
  private readonly reserve: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    const yt = config.get('youtube', { infer: true });
    this.limit = yt.dailyQuotaUnits;
    this.reserve = yt.quotaReserveUnits;
  }

  /** Atomically books units for today or throws QuotaExceededError; a reserve is kept for interactive calls. */
  async consume(units: number, { interactive = false } = {}): Promise<void> {
    const max = interactive ? this.limit : this.limit - this.reserve;
    const day = quotaDay(new Date());
    const rows = await this.prisma.$queryRaw<Array<{ units: number }>>`
      INSERT INTO api_quota_usage (id, usage_date, units, updated_at)
      SELECT gen_random_uuid()::text, ${day}::date, ${units}, now()
      WHERE ${units} <= ${max}
      ON CONFLICT (usage_date) DO UPDATE SET units = api_quota_usage.units + ${units}, updated_at = now()
      WHERE api_quota_usage.units + ${units} <= ${max}
      RETURNING units`;
    if (!rows.length) throw new QuotaExceededError(nextQuotaReset(new Date()));
  }

  async today(): Promise<{ used: number; limit: number }> {
    const row = await this.prisma.apiQuotaUsage.findUnique({ where: { usageDate: new Date(quotaDay(new Date())) } });
    return { used: row?.units ?? 0, limit: this.limit };
  }
}
