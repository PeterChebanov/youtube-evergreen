import {
  adviceRunResultSchema,
  factResearchStateSchema,
  planContentSchema,
  projectSchema,
  topicMemorySchema,
  writerStateSchema,
  type FactResearchState,
} from '@youtube-ai-tool/shared';
import { Harness, researchChannel, startApp, waitFor } from './harness';

/** Advice → plan → fact research → writer → My Videos, as the author goes through it. */
describe('Script pipeline', () => {
  let h: Harness;
  let projectId: string;

  const facts = async () => factResearchStateSchema.parse((await h.http().get(`/projects/${projectId}/facts`).expect(200)).body);
  const settled = (s: FactResearchState) => s.status === 'done' || s.status === 'failed';
  const script = async () => writerStateSchema.parse((await h.http().get(`/projects/${projectId}/script`).expect(200)).body);

  beforeAll(async () => {
    h = await startApp();
    await h.reset();
    await researchChannel(h, 'history-lab');
    await researchChannel(h, 'city-stories');
  });
  afterAll(() => h.close());

  it('Advice proposes one rework and two analogues built on evergreen library videos', async () => {
    const res = await h.http().post('/advice').send({}).expect(201);
    const advice = adviceRunResultSchema.parse(res.body);
    expect(advice.topics.map((t) => t.type).sort()).toEqual(['analog', 'analog', 'rework']);

    const sourceIds = advice.topics.flatMap((t) => t.sourceVideoIds);
    const sources = await h.prisma.video.findMany({ where: { id: { in: sourceIds } }, include: { analysis: true } });
    expect(sources).toHaveLength(new Set(sourceIds).size);
    expect(sources.every((v) => v.analysis?.contentType === 'evergreen')).toBe(true);

    const project = projectSchema.parse(
      (await h.http().post('/projects/from-advice').send({ runId: advice.runId, topicIndex: 0 }).expect(201)).body,
    );
    expect(project).toMatchObject({ status: 'draft', entryType: 'advice', targetDurationMin: 52 });
    projectId = project.id;
    await h.http().post('/projects/from-advice').send({ runId: advice.runId, topicIndex: 1 }).expect(409);
  });

  it('respects the period filter', async () => {
    await h.http().post('/advice').send({ period: { kind: 'last', months: 1 } }).expect(409);
  });

  it('does not let the writer start before the plan and research are approved', async () => {
    await h.http().post(`/projects/${projectId}/script/chapters/1/write`).expect(409);
  });

  it('plans to the target duration, using the library through read-only tools', async () => {
    const res = await h.http().post(`/projects/${projectId}/plan/generate`).expect(201);
    const plan = planContentSchema.parse(res.body.content);
    const total = plan.chapters.reduce((s, c) => s + c.lengthMin, 0);
    expect(Math.abs(total - 52)).toBeLessThan(1);
    expect(plan.riddle.plantMin).toBeLessThan(plan.riddle.answerMin);

    const call = await h.prisma.llmCall.findFirstOrThrow({ where: { projectId, promptName: 'planning' } });
    expect(call.dbToolsUsed).toContain('find_videos');
  });

  it('keeps every plan iteration', async () => {
    await h.http().post(`/projects/${projectId}/plan/refine`).send({ feedback: 'Make chapter two about the people' }).expect(201);
    const versions = (await h.http().get(`/projects/${projectId}/plan`).expect(200)).body;
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0].feedback).toBe('Make chapter two about the people');
  });

  it('researches every chapter after "Send to research" and keeps only sourced facts', async () => {
    await h.http().post(`/projects/${projectId}/plan/approve`).expect(201);
    await h.http().post(`/projects/${projectId}/plan/refine`).send({ feedback: 'late change' }).expect(409);

    const state = await waitFor(facts, settled);
    expect(state.status).toBe('done');
    expect(state.chapters.every((c) => c.state === 'done' && c.factCount > 0)).toBe(true);
    const ids = new Set(state.facts.map((f) => f.id));
    expect(state.facts.every((f) => /^https?:\/\//.test(f.sourceUrl))).toBe(true);
    expect(state.facts.flatMap((f) => f.relations).every((r) => ids.has(r.factId))).toBe(true);
  });

  it('refines the facts of one chapter as a new iteration', async () => {
    await h.http().post(`/projects/${projectId}/facts/refine`).send({ feedback: 'more eyewitnesses', chapterOrder: 1 }).expect(201);
    const state = await waitFor(facts, settled);
    expect(new Set(state.facts.filter((f) => f.planChapterOrder === 1).map((f) => f.iteration))).toEqual(new Set([2]));
    expect(new Set(state.facts.filter((f) => f.planChapterOrder === 2).map((f) => f.iteration))).toEqual(new Set([1]));
  });

  it('lets the author add a sourced fact by hand and remove one', async () => {
    const added = (
      await h.http().post(`/projects/${projectId}/facts`).send({ planChapterOrder: 2, text: 'A hand-picked fact', sourceUrl: 'https://archive.example/doc' }).expect(201)
    ).body;
    await h.http().delete(`/projects/${projectId}/facts/${added.id}`).expect(204);
  });

  it('writes chapter by chapter, each one aware of what was already told', async () => {
    await h.http().post(`/projects/${projectId}/facts/approve`).expect(201);

    await h.http().post(`/projects/${projectId}/script/chapters/2/write`).expect(409);
    await h.http().post(`/projects/${projectId}/script/chapters/1/write`).expect(201);
    await h.http().post(`/projects/${projectId}/script/chapters/2/write`).expect(409);
    await h.http().post(`/projects/${projectId}/script/chapters/1/refine`).send({ feedback: 'shorter intro' }).expect(201);
    await h.http().post(`/projects/${projectId}/script/chapters/1/approve`).expect(201);

    await h.http().post(`/projects/${projectId}/script/chapters/2/write`).expect(201);
    const state = await script();
    expect(state.chapters[0]).toMatchObject({ status: 'approved', version: 2 });
    expect(state.chapters[0].summary).toBeTruthy();
    expect(state.chapters[1].text).toContain('We already know');
    expect(state.canFinalize).toBe(false);
    await h.http().post(`/projects/${projectId}/script/finalize`).expect(409);
  });

  it('saves the finished script to My Videos and closes the project', async () => {
    let state = await script();
    for (const c of state.chapters.filter((ch) => ch.status !== 'approved')) {
      if (c.status === 'todo') await h.http().post(`/projects/${projectId}/script/chapters/${c.chapterOrder}/write`).expect(201);
      await h.http().put(`/projects/${projectId}/script/chapters/${c.chapterOrder}`).send({ text: `Edited chapter ${c.chapterOrder}` }).expect(200);
      await h.http().post(`/projects/${projectId}/script/chapters/${c.chapterOrder}/approve`).expect(201);
    }
    state = await script();
    expect(state.canFinalize).toBe(true);

    const md = (await h.http().get(`/projects/${projectId}/script/export`).expect(200)).text;
    expect(md).toContain('Edited chapter 2');

    await h.http().post(`/projects/${projectId}/script/finalize`).expect(201);
    expect((await h.http().get(`/projects/${projectId}`).expect(200)).body.status).toBe('done');
    const mine = (await h.http().get('/my-videos').expect(200)).body;
    expect(mine).toEqual([expect.objectContaining({ projectId })]);
    const memory = topicMemorySchema.parse((await h.http().get('/my-videos/memory').expect(200)).body);
    expect(memory).toEqual({ indexed: 1, total: 1, closestPair: null });
  });

  it('uses the library for a custom request only when the author refers to it', async () => {
    const plain = (await h.http().post('/projects/custom').send({ request: 'The story of the Titanic' }).expect(201)).body;
    const withDb = (await h.http().post('/projects/custom').send({ request: 'Посмотри в базе ролики про Чернобыль' }).expect(201)).body;
    expect([plain.useDatabase, withDb.useDatabase]).toEqual([false, true]);
  });

  it('builds a custom request on a video outside the library without storing it', async () => {
    const before = await h.prisma.video.count();
    const res = await h.http().post('/projects/custom').send({ request: 'Retell this', videoUrl: 'https://youtu.be/Qq1Qq1Qq1Qq' }).expect(201);
    const project = await h.prisma.project.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(project.sourceVideoSnapshot).toMatchObject({ inLibrary: false, youtubeVideoId: 'Qq1Qq1Qq1Qq' });
    expect(await h.prisma.video.count()).toBe(before);
  });
});
