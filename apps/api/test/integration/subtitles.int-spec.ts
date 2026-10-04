import { subtitleCheckSchema, transcriptAnalysisSchema, videoUrl } from '@youtube-ai-tool/shared';
import { Harness, researchChannel, startApp } from './harness';

/** REQUIREMENTS 6.1.1–6.1.4 and 6.2, with the offline YouTube and subtitle providers. */
describe('Subtitles', () => {
  let h: Harness;
  const check = async (youtubeVideoId: string) =>
    subtitleCheckSchema.parse((await h.http().post('/subtitles/check').send({ url: videoUrl(youtubeVideoId) }).expect(201)).body);
  const fetch = (youtubeVideoId: string, confirm: Record<string, boolean> = {}) =>
    h.http().post('/subtitles/fetch').send({ url: videoUrl(youtubeVideoId), ...confirm }).expect(201);

  beforeAll(async () => {
    h = await startApp();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it('downloads straight away for a stored video with an unchanged title', async () => {
    const channel = await researchChannel(h, 'history-lab');
    const video = (await h.prisma.video.findFirst({ where: { channelId: channel.id } }))!;
    expect((await check(video.youtubeVideoId)).scenario).toBe('match');

    const res = await fetch(video.youtubeVideoId);
    expect(res.body.outcome).toBe('saved');
    expect(await h.prisma.video.findUnique({ where: { id: video.id } })).toMatchObject({ transcriptStatus: 'done' });
  });

  it('asks before downloading when the title on YouTube changed', async () => {
    const channel = await researchChannel(h, 'history-lab');
    const video = (await h.prisma.video.findFirst({ where: { channelId: channel.id } }))!;
    await h.prisma.video.update({ where: { id: video.id }, data: { title: 'Old title' } });

    expect(await check(video.youtubeVideoId)).toMatchObject({ scenario: 'title_mismatch', dbTitle: 'Old title' });
    expect((await fetch(video.youtubeVideoId)).body).toMatchObject({ outcome: 'confirmation_required', confirmation: 'confirmTitleMismatch' });
    expect((await h.prisma.video.findUnique({ where: { id: video.id } }))!.transcriptStatus).toBe('empty');
    expect((await fetch(video.youtubeVideoId, { confirmTitleMismatch: true })).body.outcome).toBe('saved');
  });

  it('reports existing subtitles and overwrites only on confirmation', async () => {
    const channel = await researchChannel(h, 'history-lab');
    const video = (await h.prisma.video.findFirst({ where: { channelId: channel.id } }))!;
    await fetch(video.youtubeVideoId);

    expect((await check(video.youtubeVideoId)).scenario).toBe('already_exists');
    expect((await fetch(video.youtubeVideoId)).body.confirmation).toBe('confirmOverwrite');
    expect((await fetch(video.youtubeVideoId, { confirmOverwrite: true })).body.outcome).toBe('saved');
  });

  it('adds an unknown video of a researched channel only after confirmation', async () => {
    const channel = await researchChannel(h, 'history-lab');
    const video = (await h.prisma.video.findFirst({ where: { channelId: channel.id } }))!;
    await h.prisma.video.delete({ where: { id: video.id } });

    expect(await check(video.youtubeVideoId)).toMatchObject({ scenario: 'not_in_db_channel_exists', channelInDb: true, channelVideoCount: 10 });
    expect((await fetch(video.youtubeVideoId)).body.confirmation).toBe('confirmAddVideo');
    expect(await h.prisma.video.count({ where: { channelId: channel.id } })).toBe(10);

    expect((await fetch(video.youtubeVideoId, { confirmAddVideo: true })).body.outcome).toBe('saved');
    const added = await h.prisma.video.findUnique({ where: { youtubeVideoId: video.youtubeVideoId }, include: { analysis: true } });
    expect(added).toMatchObject({ channelId: channel.id, transcriptStatus: 'done' });
    expect(added!.analysis).not.toBeNull();
  });

  it('creates a partial channel without author style for a video of an unknown channel', async () => {
    const id = 'Zq7Zq7Zq7Zq';
    expect(await check(id)).toMatchObject({ scenario: 'not_in_db_channel_missing', channelInDb: false });
    expect((await fetch(id)).body.outcome).toBe('confirmation_required');
    expect(await h.prisma.channel.count()).toBe(0);

    expect((await fetch(id, { confirmAddVideo: true })).body.outcome).toBe('saved');
    const channel = await h.prisma.channel.findFirstOrThrow({ include: { _count: { select: { videos: true, authorStyles: true } } } });
    expect(channel).toMatchObject({ researchStatus: 'partial', _count: { videos: 1, authorStyles: 0 } });
  });

  it('marks subtitles unavailable when the video has none', async () => {
    const id = 'xNoSubs0001';
    const res = await fetch(id, { confirmAddVideo: true });
    expect(res.body.outcome).toBe('unavailable');
    expect(await h.prisma.video.findUnique({ where: { youtubeVideoId: id } })).toMatchObject({ transcriptStatus: 'unavailable', transcript: 'unavailable' });
  });

  it('analyses tone from subtitles and refines the structure', async () => {
    const id = 'Zq7Zq7Zq7Zq';
    await fetch(id, { confirmAddVideo: true });
    const video = await h.prisma.video.findUniqueOrThrow({ where: { youtubeVideoId: id } });

    const res = await h.http().post(`/subtitles/videos/${video.id}/analyze`).expect(201);
    expect(transcriptAnalysisSchema.safeParse(res.body).success).toBe(true);
    expect((await check(id)).transcriptAnalysis).not.toBeNull();
    expect(await h.prisma.video.findUnique({ where: { id: video.id } })).toMatchObject({ structureStatus: 'done' });
  });

  it('refuses to analyse a video without subtitles', async () => {
    const id = 'xNoSubs0002';
    await fetch(id, { confirmAddVideo: true });
    const video = await h.prisma.video.findUniqueOrThrow({ where: { youtubeVideoId: id } });
    await h.http().post(`/subtitles/videos/${video.id}/analyze`).expect(409);
  });
});
