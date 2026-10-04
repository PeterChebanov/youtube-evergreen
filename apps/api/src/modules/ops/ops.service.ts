import { Injectable } from '@nestjs/common';
import type { LlmDefaults, OpsStatus, SearchOption } from '@youtube-ai-tool/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { QueueService } from '../queue/queue.service';
import { SearchService } from '../search/search.service';
import { StyleService } from '../style/style.service';
import { QuotaService } from '../youtube/quota.service';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly quota: QuotaService,
    private readonly llm: LlmService,
    private readonly search: SearchService,
    private readonly style: StyleService,
  ) {}

  searchOptions(): SearchOption[] {
    return this.search.options();
  }

  llmDefaults(): LlmDefaults {
    return { researchModel: this.llm.researchDefaultModel(), writerModel: this.llm.writerDefaultModel() };
  }

  /** Data for the status bar. */
  async status(): Promise<OpsStatus> {
    const [queues, youtubeQuota, spend, videoCount, styleUpdateSuggested] = await Promise.all([
      this.queue.counts(),
      this.quota.today(),
      this.prisma.llmCall.aggregate({ where: { createdAt: { gte: startOfToday() } }, _sum: { inputTokens: true, outputTokens: true } }),
      this.prisma.video.count(),
      this.style.updateSuggested(),
    ]);
    return {
      api: 'ok',
      queues,
      youtubeQuota,
      llmSpendTodayUsd: this.llm.costUsd(spend._sum.inputTokens ?? 0, spend._sum.outputTokens ?? 0),
      videoCount,
      styleUpdateSuggested,
    };
  }

  /** LLM spend by prompt and by project (REQUIREMENTS Ops). */
  async spend(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [byPrompt, byProject] = await Promise.all([
      this.prisma.llmCall.groupBy({ by: ['promptName', 'model'], where: { createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true }, _count: true }),
      this.prisma.llmCall.groupBy({ by: ['projectId'], where: { createdAt: { gte: since }, projectId: { not: null } }, _sum: { inputTokens: true, outputTokens: true }, _count: true }),
    ]);
    const titles = new Map(
      (await this.prisma.project.findMany({ where: { id: { in: byProject.map((p) => p.projectId!) } }, select: { id: true, title: true } })).map((p) => [p.id, p.title]),
    );
    const usd = (s: { inputTokens: number | null; outputTokens: number | null }) => this.llm.costUsd(s.inputTokens ?? 0, s.outputTokens ?? 0);
    return {
      since: since.toISOString(),
      byPrompt: byPrompt.map((r) => ({ promptName: r.promptName, model: r.model, calls: r._count, ...r._sum, usd: usd(r._sum) })),
      byProject: byProject.map((r) => ({ projectId: r.projectId, title: titles.get(r.projectId!) ?? null, calls: r._count, ...r._sum, usd: usd(r._sum) })),
    };
  }
}
