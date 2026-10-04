import { opsStatusSchema } from '@youtube-ai-tool/shared';
import { Harness, researchChannel, startApp } from './harness';

describe('Database view and status', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startApp();
    await h.reset();
    await researchChannel(h, 'history-lab');
  });
  afterAll(() => h.close());

  it('shows a table exactly as stored, sorted and paged', async () => {
    const res = await h.http().get('/database/tables/videos?sort=views_at_research&dir=desc&limit=5').expect(200);
    expect(res.body.total).toBe(11);
    expect(res.body.rows).toHaveLength(5);
    expect(res.body.columns.map((c: { name: string }) => c.name)).toEqual(expect.arrayContaining(['youtube_video_id', 'views_at_research', 'chapters_status']));
    const views = res.body.rows.map((r: { views_at_research: string }) => Number(r.views_at_research));
    expect(views).toEqual([...views].sort((a, b) => b - a));
  });

  it('filters by column and searches across cells', async () => {
    const channel = await h.prisma.channel.findFirstOrThrow();
    const byChannel = await h.http().get(`/database/tables/videos?eq.channel_id=${channel.id}`).expect(200);
    expect(byChannel.body.total).toBe(11);
    const search = await h.http().get('/database/tables/videos?q=pyramids').expect(200);
    expect(search.body.total).toBe(1);
  });

  it('summarises vectors instead of dumping them', async () => {
    const res = await h.http().get('/database/tables/video_analyses?limit=1').expect(200);
    expect(res.body.rows[0].embedding).toBe('vector(1536)');
  });

  it('exports the whole table as TSV', async () => {
    const res = await h.http().get('/database/tables/videos/export').expect(200);
    expect(res.text.split('\n')).toHaveLength(12);
  });

  it('refuses tables outside the application schema', async () => {
    await h.http().get('/database/tables/pg_user').expect(422);
  });

  it('reports queues, quota, LLM spend and library size for the status bar', async () => {
    const status = opsStatusSchema.parse((await h.http().get('/ops/status').expect(200)).body);
    expect(status).toMatchObject({ api: 'ok', videoCount: 11, styleUpdateSuggested: true });
    expect(status.llmSpendTodayUsd).toBeGreaterThan(0);

    await h.http().post('/style/draft').expect(201);
    expect((await h.http().get('/ops/status').expect(200)).body.styleUpdateSuggested).toBe(false);
  });
});
