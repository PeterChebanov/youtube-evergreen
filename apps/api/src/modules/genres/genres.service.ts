import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { genrePracticesSchema, genreRequestSchema, genreUpdateRequestSchema } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { conflict, errorMessage, orNotFound } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { StatsRepository } from '../../prisma/stats.repository';
import { LlmService } from '../llm/llm.service';
import { PromptComposer } from '../prompts/prompt-composer.service';
import { defaultPromptModule, GENRE_SEED } from './genre.seed';
import { rankTopAuthors } from './top-authors';

const SAMPLE_VIDEOS = 12;

@Injectable()
export class GenresService implements OnModuleInit {
  private readonly logger = new Logger(GenresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsRepository,
    private readonly llm: LlmService,
    private readonly composer: PromptComposer,
  ) {}

  /** Seeds the genre list once; genres the author deletes later stay deleted. */
  async onModuleInit() {
    if (await this.prisma.genre.count()) return;
    await this.prisma.genre.createMany({
      data: GENRE_SEED.map((g) => ({ ...g, promptModule: defaultPromptModule(g.focus) })),
      skipDuplicates: true,
    });
  }

  async list() {
    const genres = await this.prisma.genre.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { videoAnalyses: true } } },
    });
    return genres.map(({ _count, ...g }) => ({ ...g, videoCount: _count.videoAnalyses }));
  }

  async create(input: z.output<typeof genreRequestSchema>) {
    if (await this.prisma.genre.findUnique({ where: { name: input.name } })) throw conflict(`Genre "${input.name}" already exists`);
    return this.prisma.genre.create({
      data: { ...input, promptModule: input.promptModule || defaultPromptModule(input.focus) },
    });
  }

  async update(id: string, input: z.output<typeof genreUpdateRequestSchema>) {
    orNotFound(await this.prisma.genre.findUnique({ where: { id } }), 'Genre');
    return this.prisma.genre.update({ where: { id }, data: input });
  }

  async remove(id: string) {
    orNotFound(await this.prisma.genre.findUnique({ where: { id } }), 'Genre');
    await this.prisma.$transaction([
      this.prisma.videoAnalysis.updateMany({ where: { genreId: id }, data: { genreId: null } }),
      this.prisma.project.updateMany({ where: { genreId: id }, data: { genreId: null } }),
      this.prisma.myVideo.updateMany({ where: { genreId: id }, data: { genreId: null } }),
      this.prisma.genre.delete({ where: { id } }),
    ]);
  }

  /** Refreshes best practices, top authors and prompt module of every genre that has videos (G.5–G.7). */
  async recomputeAll(): Promise<{ updated: number; failed: string[] }> {
    const genres = await this.prisma.genre.findMany();
    const medians = await this.stats.channelMedians();
    const failed: string[] = [];
    let updated = 0;
    for (const genre of genres) {
      try {
        if (await this.recompute(genre.id, medians)) updated++;
      } catch (e) {
        this.logger.warn(`Genre "${genre.name}" recompute failed: ${errorMessage(e)}`);
        failed.push(genre.name);
      }
    }
    return { updated, failed };
  }

  private async recompute(genreId: string, medians: Map<string, number>): Promise<boolean> {
    const genre = orNotFound(await this.prisma.genre.findUnique({ where: { id: genreId } }), 'Genre');
    const videos = await this.prisma.video.findMany({
      where: { analysis: { genreId } },
      include: { channel: { select: { id: true, channelName: true } }, analysis: { select: { hook: true, format: true } } },
    });
    if (!videos.length) return false;

    const topAuthors = rankTopAuthors(
      videos.map((v) => ({ channelId: v.channelId, channelName: v.channel.channelName, views: v.viewsAtResearch })),
      medians,
    );
    const styles = await this.prisma.authorStyle.findMany({
      where: { channelId: { in: topAuthors.map((a) => a.channelId) } },
      orderBy: { order: 'asc' },
    });
    const authors = topAuthors.map((a) => ({
      ...a,
      techniques: styles.filter((s) => s.channelId === a.channelId).slice(0, 3).map((s) => ({
        authorStyleId: s.id,
        technique: s.technique,
        description: s.description,
      })),
    }));
    const samples = [...videos]
      .sort((a, b) => b.viewsAtResearch / (medians.get(b.channelId) || 1) - a.viewsAtResearch / (medians.get(a.channelId) || 1))
      .slice(0, SAMPLE_VIDEOS)
      .map((v) => ({ title: v.title, channel: v.channel.channelName, views: v.viewsAtResearch, ...v.analysis }));

    const { data } = await this.llm.completeStructured({
      promptName: 'genre_practices',
      stageId: 'genre_practices',
      system: await this.composer.single('genre_practices'),
      user: { genre: genre.name, focus: genre.focus, topVideos: samples, topAuthors: authors },
      schema: genrePracticesSchema,
    });
    await this.prisma.genre.update({
      where: { id: genreId },
      data: { retentionBestPractices: data.retentionBestPractices, promptModule: data.promptModule, topAuthors: authors },
    });
    return true;
  }
}
