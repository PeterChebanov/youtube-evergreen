import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import type { LlmToolCall, ToolSet } from '../llm/llm.types';
import { referencesDatabase } from './db-reference';

const MAX_ROWS = 25;

const findVideosArgs = z.object({
  query: z.string().optional(),
  channelId: z.string().optional(),
  genre: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_ROWS).optional(),
});
const idArgs = z.object({ id: z.string() });
const findChannelsArgs = z.object({ query: z.string().optional() });

const schemaOf = (properties: Record<string, object>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

/** Read-only access to the research library for LLM prompts (REQUIREMENTS P4). */
@Injectable()
export class DbToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async shouldUse(text: string, explicit: boolean): Promise<boolean> {
    if (explicit) return true;
    const channels = await this.prisma.channel.findMany({ select: { channelName: true } });
    return referencesDatabase(text, channels.map((c) => c.channelName));
  }

  toolSet(): ToolSet {
    return {
      definitions: [
        {
          name: 'find_videos',
          description: 'Search researched videos by title/topic words, channel or genre. Sorted by views.',
          parameters: schemaOf({
            query: { type: 'string' },
            channelId: { type: 'string' },
            genre: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
          }),
        },
        {
          name: 'get_video',
          description: 'Full stored data of one video: chapters, sub-sections, analysis, view snapshots.',
          parameters: schemaOf({ id: { type: 'string' } }, ['id']),
        },
        {
          name: 'find_channels',
          description: 'List researched channels, optionally filtered by name.',
          parameters: schemaOf({ query: { type: 'string' } }),
        },
        {
          name: 'get_author_style',
          description: 'Signature techniques (AuthorStyle) of one channel.',
          parameters: schemaOf({ id: { type: 'string' } }, ['id']),
        },
      ],
      execute: (call) => this.execute(call),
    };
  }

  private async execute(call: LlmToolCall): Promise<unknown> {
    switch (call.name) {
      case 'find_videos':
        return this.findVideos(findVideosArgs.parse(call.arguments));
      case 'get_video':
        return this.getVideo(idArgs.parse(call.arguments).id);
      case 'find_channels':
        return this.findChannels(findChannelsArgs.parse(call.arguments).query);
      case 'get_author_style':
        return this.prisma.authorStyle.findMany({
          where: { channelId: idArgs.parse(call.arguments).id },
          orderBy: { order: 'asc' },
          select: { technique: true, description: true, exampleVideoIds: true },
        });
      default:
        throw new Error(`Unknown tool ${call.name}`);
    }
  }

  private findVideos({ query, channelId, genre, limit }: z.infer<typeof findVideosArgs>) {
    const words = (query ?? '').split(/\s+/).filter((w) => w.length > 2).slice(0, 5);
    return this.prisma.video.findMany({
      where: {
        ...(channelId ? { channelId } : {}),
        ...(genre ? { analysis: { genre: { name: { contains: genre, mode: 'insensitive' } } } } : {}),
        ...(words.length
          ? {
              OR: words.flatMap((w) => [
                { title: { contains: w, mode: 'insensitive' as const } },
                { analysis: { topic: { contains: w, mode: 'insensitive' as const } } },
              ]),
            }
          : {}),
      },
      orderBy: { viewsAtResearch: 'desc' },
      take: limit ?? 10,
      select: {
        id: true,
        title: true,
        url: true,
        publishedAt: true,
        viewsAtResearch: true,
        durationSec: true,
        channel: { select: { id: true, channelName: true } },
        analysis: { select: { topic: true, hook: true, contentType: true, genre: { select: { name: true } } } },
      },
    });
  }

  private getVideo(id: string) {
    return this.prisma.video.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        url: true,
        publishedAt: true,
        viewsAtResearch: true,
        durationSec: true,
        description: true,
        channel: { select: { id: true, channelName: true } },
        chapters: { orderBy: { order: 'asc' }, select: { title: true, startTimestamp: true, subsections: { select: { title: true, description: true } } } },
        analysis: { select: { topic: true, subtopic: true, hook: true, format: true, titleType: true, transcriptAnalysis: true } },
        snapshots: { orderBy: { researchedAt: 'asc' }, select: { researchedAt: true, views: true } },
      },
    });
  }

  private async findChannels(query?: string) {
    const channels = await this.prisma.channel.findMany({
      where: query ? { channelName: { contains: query, mode: 'insensitive' } } : {},
      take: MAX_ROWS,
      select: { id: true, channelName: true, researchStatus: true, subscribers: true, _count: { select: { videos: true } } },
    });
    return channels.map(({ _count, ...c }) => ({ ...c, videoCount: _count.videos }));
  }
}
