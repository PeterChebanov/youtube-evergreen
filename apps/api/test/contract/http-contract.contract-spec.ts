import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { conflict, invalid, notFound, unavailable } from '../../src/common/domain-error';
import { configureApp } from '../../src/main';
import { AdviceController } from '../../src/modules/advice/advice.controller';
import { AdviceService } from '../../src/modules/advice/advice.service';
import { DatabaseViewController } from '../../src/modules/database-view/database-view.controller';
import { DatabaseViewService } from '../../src/modules/database-view/database-view.service';
import { FactResearchController } from '../../src/modules/fact-research/fact-research.controller';
import { FactResearchService } from '../../src/modules/fact-research/fact-research.service';
import { LibraryController } from '../../src/modules/library/library.controller';
import { ResearchService } from '../../src/modules/library/research.service';
import { SingleVideoService } from '../../src/modules/library/single-video.service';
import { AnalysisService } from '../../src/modules/analysis/analysis.service';
import { PlanningController } from '../../src/modules/planning/planning.controller';
import { PlanningService } from '../../src/modules/planning/planning.service';
import { ProjectsController } from '../../src/modules/projects/projects.controller';
import { ProjectsService } from '../../src/modules/projects/projects.service';
import { SubtitlesController } from '../../src/modules/subtitles/subtitles.controller';
import { SubtitlesService } from '../../src/modules/subtitles/subtitles.service';
import { WriterController } from '../../src/modules/writer/writer.controller';
import { WriterService } from '../../src/modules/writer/writer.service';

type Stub = Record<string, jest.Mock>;

const SERVICES: Array<[Type, string[]]> = [
  [AdviceService, ['run', 'history', 'library', 'refineTopic']],
  [ProjectsService, ['createFromCustomRequest', 'createFromAdvice', 'list', 'get', 'update', 'remove']],
  [PlanningService, ['versions', 'generate', 'refine', 'refineChapter', 'retryChapter', 'refineAllChapters', 'saveManual', 'addChapter', 'approve']],
  [FactResearchService, ['state', 'refine', 'retry', 'retryBatch', 'addFact', 'deleteFact', 'approve']],
  [WriterService, ['state', 'write', 'refine', 'saveManual', 'approve', 'finalize', 'exportMarkdown', 'fullScriptText', 'saveFullScript', 'refineSnippet']],
  [SubtitlesService, ['check', 'fetch', 'analyze']],
  [ResearchService, ['preview', 'start', 'retry', 'refreshAll', 'listChannels', 'detail', 'channelVideos', 'rerun', 'reanalyze']],
  [SingleVideoService, ['storedView', 'snapshot']],
  [AnalysisService, ['ensureStructure']],
  [DatabaseViewService, ['tables', 'rows', 'exportTsv']],
];

describe('HTTP contract', () => {
  let app: INestApplication;
  const stubs = new Map<Type, Stub>();
  const stub = (t: Type) => stubs.get(t)!;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [
        AdviceController,
        ProjectsController,
        PlanningController,
        FactResearchController,
        WriterController,
        SubtitlesController,
        LibraryController,
        DatabaseViewController,
      ],
      providers: SERVICES.map(([token, methods]) => {
        const value = Object.fromEntries(methods.map((m) => [m, jest.fn().mockResolvedValue({ ok: true })]));
        stubs.set(token, value);
        return { provide: token, useValue: value };
      }),
    });
    app = configureApp((await builder.compile()).createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => stubs.forEach((s) => Object.values(s).forEach((m) => m.mockClear())));

  const http = () => request(app.getHttpServer());

  describe('request validation', () => {
    it('fills Advice defaults: no repeats of my videos, Russian, 52 minutes', async () => {
      await http().post('/advice').send({}).expect(201);
      expect(stub(AdviceService).run).toHaveBeenCalledWith({
        genreIds: [],
        skipMyVideos: true,
        language: 'ru',
        targetDurationMin: 52,
      });
    });

    it('rejects an Advice duration outside 8–120 minutes and names the field', async () => {
      const res = await http().post('/advice').send({ targetDurationMin: 5 }).expect(400);
      expect(res.body).toMatchObject({ error: 'validation', issues: [expect.objectContaining({ path: 'targetDurationMin' })] });
      expect(stub(AdviceService).run).not.toHaveBeenCalled();
    });

    it('accepts every Advice period shape', async () => {
      for (const period of [{ kind: 'last', months: 3 }, { kind: 'range', fromYearsAgo: 3, toYearsAgo: 5 }, { kind: 'olderThan', years: 2 }]) {
        await http().post('/advice').send({ period }).expect(201);
      }
      await http().post('/advice').send({ period: { kind: 'someday' } }).expect(400);
    });

    it('requires the text of a custom request and leaves the database off unless asked', async () => {
      await http().post('/projects/custom').send({ request: '   ' }).expect(400);
      await http().post('/projects/custom').send({ request: 'Fall of the USSR', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }).expect(201);
      expect(stub(ProjectsService).createFromCustomRequest).toHaveBeenCalledWith(
        expect.objectContaining({ request: 'Fall of the USSR', useDatabase: false, researchChannelIntoDb: false }),
      );
    });

    it('allows picking only one of the three Advice topics', async () => {
      await http().post('/projects/from-advice').send({ runId: 'r1', topicIndex: 3 }).expect(400);
      await http().post('/projects/from-advice').send({ runId: 'r1', topicIndex: 2 }).expect(201);
    });

    it('rejects a manual plan whose riddle is answered before it is planted', async () => {
      const chapters = [1, 2, 3].map((i) => ({ title: `C${i}`, description: 'd', lengthMin: 10 }));
      const base = {
        narrativeFramework: 'One framework for the whole video.',
        recurringCast: [],
        chapters,
      };
      await http().put('/projects/p1/plan').send({ ...base, riddle: { question: 'q', plantMin: 30, answerMin: 5 } }).expect(400);
      await http().put('/projects/p1/plan').send({ ...base, riddle: { question: 'q', plantMin: 1, answerMin: 25 } }).expect(200);
    });

    it('never accepts a manual fact without a web link', async () => {
      const fact = { planChapterOrder: 1, text: 'A fact' };
      await http().post('/projects/p1/facts').send(fact).expect(400);
      await http().post('/projects/p1/facts').send({ ...fact, sourceUrl: 'javascript:alert(1)' }).expect(400);
      await http().post('/projects/p1/facts').send({ ...fact, sourceUrl: 'https://archive.example/doc' }).expect(201);
    });

    it('addresses writer chapters by number', async () => {
      await http().post('/projects/p1/script/chapters/abc/write').expect(400);
      await http().post('/projects/p1/script/chapters/2/write').expect(201);
      expect(stub(WriterService).write).toHaveBeenCalledWith('p1', 2);
    });

    it('fetches subtitles only with explicit confirmations, all off by default', async () => {
      await http().post('/subtitles/fetch').send({ url: 'https://youtu.be/dQw4w9WgXcQ' }).expect(201);
      expect(stub(SubtitlesService).fetch).toHaveBeenCalledWith({
        url: 'https://youtu.be/dQw4w9WgXcQ',
        confirmTitleMismatch: false,
        confirmAddVideo: false,
        confirmOverwrite: false,
      });
    });

    it('passes database filters, sorting and paging through', async () => {
      await http().get('/database/tables/videos?sort=views_at_research&dir=desc&limit=50&offset=100&eq.channel_id=c1').expect(200);
      expect(stub(DatabaseViewService).rows).toHaveBeenCalledWith('videos', {
        sort: 'views_at_research',
        dir: 'desc',
        q: undefined,
        limit: 50,
        offset: 100,
        eq: { channel_id: 'c1' },
      });
    });
  });

  describe('business errors', () => {
    it.each([
      [notFound('Project'), 404, 'not_found'],
      [conflict('Approve chapter 1 before writing chapter 2'), 409, 'conflict'],
      [invalid('Not a YouTube channel link'), 422, 'invalid'],
      [unavailable('yt-dlp not found'), 503, 'unavailable'],
    ])('maps %p to HTTP %i', async (error, status, code) => {
      stub(WriterService).write.mockRejectedValueOnce(error);
      const res = await http().post('/projects/p1/script/chapters/2/write').expect(status);
      expect(res.body).toEqual({ statusCode: status, error: code, message: error.message });
    });
  });

  describe('responses', () => {
    it('serves the script export as Markdown', async () => {
      stub(WriterService).exportMarkdown.mockResolvedValueOnce('# Title\n');
      const res = await http().get('/projects/p1/script/export').expect(200);
      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.text).toBe('# Title\n');
    });

    it('serves table exports as TSV', async () => {
      stub(DatabaseViewService).exportTsv.mockResolvedValueOnce('id\ttitle\n1\tx');
      const res = await http().get('/database/tables/videos/export').expect(200);
      expect(res.headers['content-type']).toContain('text/tab-separated-values');
    });
  });
});
