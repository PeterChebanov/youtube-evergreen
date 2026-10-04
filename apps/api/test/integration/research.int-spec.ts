import { channelDetailSchema, opsStatusSchema } from '@youtube-ai-tool/shared';
import { quotaDay } from '../../src/modules/youtube/quota';
import { channelSummary, Harness, researchChannel, startApp, waitFor } from './harness';

/** The mock channel has 12 uploads in pages of 5: one Short, one news video, one without a description. */
describe('Research a channel', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startApp();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it('previews the size and cost before starting', async () => {
    const res = await h.http().post('/library/research/preview').send({ channelUrl: '@history-lab' }).expect(201);
    expect(res.body).toMatchObject({ channelName: 'Mock history-lab', videoCount: 12, inLibrary: false, estimate: { videoCount: 12 } });
    expect(res.body.estimate.estimatedUsd).toBeGreaterThan(0);
  });

  it('rejects links that are not channels', async () => {
    await h.http().post('/library/research').send({ channelUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).expect(422);
  });

  it('stores every long video with chapters, analysis and a view snapshot, then learns the author style', async () => {
    const channel = await researchChannel(h, 'history-lab');
    expect(channel).toMatchObject({ videoCount: 11, analyzedCount: 11, researchStatus: 'ready' });

    const videos = await h.prisma.video.findMany({ where: { channelId: channel.id }, include: { chapters: true, snapshots: true } });
    expect(videos.every((v) => v.durationSec >= 60)).toBe(true);
    expect(videos.find((v) => v.title === 'Who really built the pyramids?')).toMatchObject({ description: 'unavailable', chaptersStatus: 'unavailable' });
    const chaptered = videos.find((v) => v.title === 'The fall of the Soviet Union')!;
    expect(chaptered.chaptersStatus).toBe('available');
    expect(chaptered.chapters.map((c) => c.title)).toEqual(['Cold open', 'How it started', 'The turning point', 'What it means']);
    expect(videos.every((v) => v.snapshots.length === 1)).toBe(true);

    const embedded = await h.prisma.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM video_analyses WHERE embedding IS NOT NULL`;
    expect(embedded[0].n).toBe(11);
    const news = await h.prisma.videoAnalysis.findFirst({ where: { video: { title: 'Breaking news this week' } } });
    expect(news?.contentType).toBe('news');

    const detail = channelDetailSchema.parse((await h.http().get(`/library/channels/${channel.id}`).expect(200)).body);
    expect(detail.authorStyles.length).toBeGreaterThanOrEqual(2);
    expect(detail.authorStyles.length).toBeLessThanOrEqual(10);
  });

  it('re-running adds no duplicates and records a new view snapshot for every video', async () => {
    const channel = await researchChannel(h, 'history-lab');
    await h.http().post(`/library/channels/${channel.id}/rerun`).expect(201);
    await waitFor(() => channelSummary(h, channel.id), (c) => c.job?.status === 'done' && c.researchStatus === 'ready');

    expect(await h.prisma.video.count({ where: { channelId: channel.id } })).toBe(11);
    expect(await h.prisma.researchSnapshot.count({ where: { video: { channelId: channel.id } } })).toBe(22);
  });

  it('does not start a second research of a channel while one is running', async () => {
    const started = await h.http().post('/library/research').send({ channelUrl: '@history-lab' }).expect(201);
    await h.http().post('/library/research').send({ channelUrl: '@history-lab' }).expect(409);
    await waitFor(() => channelSummary(h, started.body.id), (c) => c.job?.status === 'done');
  });

  it('bills every YouTube request against the daily quota', async () => {
    await researchChannel(h, 'history-lab');
    const status = opsStatusSchema.parse((await h.http().get('/ops/status').expect(200)).body);
    expect(status.youtubeQuota).toEqual({ used: 7, limit: 10000 });
  });

  it('pauses when the quota runs out and resumes from the same page without duplicates', async () => {
    await h.prisma.apiQuotaUsage.create({ data: { usageDate: new Date(quotaDay(new Date())), units: 9797 } });
    const started = await h.http().post('/library/research').send({ channelUrl: '@history-lab' }).expect(201);
    const paused = await waitFor(() => channelSummary(h, started.body.id), (c) => c.job?.status === 'paused_quota');
    expect(paused.videoCount).toBe(5);
    expect(new Date(paused.job!.pausedUntil!).getTime()).toBeGreaterThan(Date.now());

    await h.prisma.apiQuotaUsage.updateMany({ data: { units: 0 } });
    await h.http().post(`/library/research-jobs/${paused.job!.id}/retry`).expect(201);
    const done = await waitFor(() => channelSummary(h, started.body.id), (c) => c.job?.status === 'done');
    expect(done.videoCount).toBe(11);
    expect(await h.prisma.researchSnapshot.count()).toBe(11);
  });
});
