import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { TopicMemory } from '@youtube-ai-tool/shared';
import { orNotFound } from '../../common/domain-error';
import { EmbeddingRepository } from '../../prisma/embedding.repository';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('my-videos')
@Controller('my-videos')
export class MyVideosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingRepository,
  ) {}

  @Get()
  list() {
    return this.prisma.myVideo.findMany({
      orderBy: { finishedAt: 'desc' },
      select: {
        id: true,
        projectId: true,
        title: true,
        language: true,
        durationMin: true,
        topic: true,
        subtopic: true,
        finishedAt: true,
        chaptersJson: true,
        genre: { select: { id: true, name: true } },
        project: { select: { title: true } },
      },
    });
  }

  /** What Advice compares new topics against (pgvector). */
  @Get('memory')
  async memory(): Promise<TopicMemory> {
    const [stats, pair] = await Promise.all([this.embeddings.myVideoIndexStats(), this.embeddings.closestMyVideoPair()]);
    if (!pair) return { ...stats, closestPair: null };
    const titles = new Map(
      (await this.prisma.myVideo.findMany({ where: { id: { in: [pair.a, pair.b] } }, select: { id: true, title: true } })).map((v) => [v.id, v.title]),
    );
    return {
      ...stats,
      closestPair: {
        a: { id: pair.a, title: titles.get(pair.a) ?? '' },
        b: { id: pair.b, title: titles.get(pair.b) ?? '' },
        similarity: Math.round(pair.similarity * 100) / 100,
      },
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return orNotFound(
      await this.prisma.myVideo.findUnique({ where: { id }, include: { genre: { select: { id: true, name: true } } } }),
      'My video',
    );
  }
}
