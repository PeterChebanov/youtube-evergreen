import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseVectorLiteral, toVectorLiteral } from '../common/vector';
import { PrismaService } from './prisma.service';

export type StoredEmbedding = { id: string; vector: number[] };

/** pgvector columns are not mapped by Prisma, so they are read and written here with raw SQL. */
@Injectable()
export class EmbeddingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async setVideoEmbedding(videoId: string, vector: number[]) {
    await this.prisma.$executeRaw`
      UPDATE video_analyses SET embedding = ${toVectorLiteral(vector)}::vector WHERE video_id = ${videoId}`;
  }

  async setMyVideoEmbedding(myVideoId: string, vector: number[]) {
    await this.prisma.$executeRaw`
      UPDATE my_videos SET embedding = ${toVectorLiteral(vector)}::vector WHERE id = ${myVideoId}`;
  }

  async videoEmbeddings(videoIds: string[]): Promise<Map<string, number[]>> {
    if (!videoIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<Array<{ id: string; v: string }>>`
      SELECT video_id AS id, embedding::text AS v FROM video_analyses
      WHERE embedding IS NOT NULL AND video_id IN (${Prisma.join(videoIds)})`;
    return new Map(rows.map((r) => [r.id, parseVectorLiteral(r.v)]));
  }

  async myVideoEmbeddings(): Promise<StoredEmbedding[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; v: string }>>`
      SELECT id, embedding::text AS v FROM my_videos WHERE embedding IS NOT NULL`;
    return rows.map((r) => ({ id: r.id, vector: parseVectorLiteral(r.v) }));
  }

  /** Library videos published after `since`, used as the "already covered recently" signal. */
  async recentLibraryEmbeddings(since: Date, limit = 2000): Promise<StoredEmbedding[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; v: string }>>`
      SELECT a.video_id AS id, a.embedding::text AS v
      FROM video_analyses a JOIN videos v ON v.id = a.video_id
      WHERE a.embedding IS NOT NULL AND v.published_at >= ${since}
      ORDER BY v.published_at DESC LIMIT ${limit}`;
    return rows.map((r) => ({ id: r.id, vector: parseVectorLiteral(r.v) }));
  }

  async myVideoIndexStats(): Promise<{ indexed: number; total: number }> {
    const [row] = await this.prisma.$queryRaw<Array<{ indexed: number; total: number }>>`
      SELECT count(embedding)::int AS indexed, count(*)::int AS total FROM my_videos`;
    return row ?? { indexed: 0, total: 0 };
  }

  /** The two finished scripts that are most alike; shows how close Advice may get to a repeat. */
  async closestMyVideoPair(): Promise<{ a: string; b: string; similarity: number } | null> {
    const [row] = await this.prisma.$queryRaw<Array<{ a: string; b: string; similarity: number }>>`
      SELECT x.id AS a, y.id AS b, (1 - (x.embedding <=> y.embedding))::float8 AS similarity
      FROM my_videos x JOIN my_videos y ON x.id < y.id
      WHERE x.embedding IS NOT NULL AND y.embedding IS NOT NULL
      ORDER BY x.embedding <=> y.embedding LIMIT 1`;
    return row ?? null;
  }

  /** Nearest library videos by cosine distance (pgvector `<=>`). */
  async nearestVideos(vector: number[], limit: number): Promise<Array<{ id: string; similarity: number }>> {
    return this.prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
      SELECT video_id AS id, 1 - (embedding <=> ${toVectorLiteral(vector)}::vector) AS similarity
      FROM video_analyses WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${toVectorLiteral(vector)}::vector LIMIT ${limit}`;
  }
}
