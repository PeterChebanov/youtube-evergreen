import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { channelSummarySchema, type ChannelSummary } from '@youtube-ai-tool/shared';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/main';
import { GenresService } from '../../src/modules/genres/genres.service';
import { PrismaService } from '../../src/prisma/prisma.service';

export type Harness = {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
};

export async function startApp(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  const prisma = app.get(PrismaService);
  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()),
    reset: async () => {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
      await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
      await app.get(GenresService).onModuleInit();
    },
    close: () => app.close(),
  };
}

export async function waitFor<T>(probe: () => Promise<T>, done: (v: T) => boolean, timeoutMs = 45000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting; last value: ${JSON.stringify(value).slice(0, 500)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function channelSummary(h: Harness, channelId: string): Promise<ChannelSummary> {
  const res = await h.http().get('/library/channels').expect(200);
  const found = (res.body as unknown[]).map((c) => channelSummarySchema.parse(c)).find((c) => c.id === channelId);
  if (!found) throw new Error(`channel ${channelId} not listed`);
  return found;
}

/** Researches a mock channel end to end and returns its summary. */
export async function researchChannel(h: Harness, handle: string): Promise<ChannelSummary> {
  const res = await h.http().post('/library/research').send({ channelUrl: `https://www.youtube.com/@${handle}` }).expect(201);
  const id = channelSummarySchema.parse(res.body).id;
  return waitFor(() => channelSummary(h, id), (c) => c.job?.status === 'done' && c.researchStatus === 'ready');
}
