import { Injectable } from '@nestjs/common';
import {
  chapterSummarySchema,
  checkScriptIntegrity,
  mergeContinuityForWriter,
  parseContinuity,
  serializeContinuity,
  targetWordsForChapter,
  formatFullScript,
  parseFullScript,
  writerChapterSchema,
  writerSnippetSchema,
  type PlanContent,
  type WriterState,
} from '@youtube-ai-tool/shared';
import type { Project, ScriptChapter } from '@prisma/client';
import { conflict } from '../../common/domain-error';
import { EmbeddingRepository } from '../../prisma/embedding.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DbToolsService } from '../db-tools/db-tools.service';
import { LlmService } from '../llm/llm.service';
import { ProjectsService } from '../projects/projects.service';
import { projectContext, PromptComposer } from '../prompts/prompt-composer.service';
import { assertCanWriteChapter, nextWritableChapter } from './chapter-gate';
import { buildScriptMarkdown } from './script-markdown';

type ChapterView = WriterState['chapters'][number];

@Injectable()
export class WriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly llm: LlmService,
    private readonly composer: PromptComposer,
    private readonly dbTools: DbToolsService,
    private readonly embeddings: EmbeddingRepository,
  ) {}

  async state(projectId: string): Promise<WriterState> {
    const project = await this.projects.load(projectId);
    const { content } = await this.projects.latestPlan(projectId);
    const latest = await this.latestVersions(projectId);
    const chapters = content.chapters.map((c): ChapterView => {
      const row = latest.get(c.order);
      return row
        ? { chapterOrder: c.order, title: c.title, version: row.version, text: row.text, summary: row.summary, status: row.status as ChapterView['status'] }
        : { chapterOrder: c.order, title: c.title, version: 0, text: '', summary: null, status: 'todo' };
    });
    return {
      chapters,
      toneFromSubtitles: project.toneReferenceVideoIds.length > 0,
      canFinalize: project.status === 'writing' && chapters.every((c) => c.status === 'approved'),
    };
  }

  /** One LLM call writes one chapter (REQUIREMENTS 5.3) with continuity from approved chapters. */
  async write(projectId: string, order: number): Promise<WriterState> {
    let project = await this.projects.assertStatus(projectId, ['research_approved', 'writing']);
    const { content } = await this.projects.latestPlan(projectId);
    const latest = await this.latestVersions(projectId);
    assertCanWriteChapter(order, content.chapters.length, approvedOrders(latest));
    if (project.status === 'research_approved') project = await this.projects.transition(projectId, 'writing');

    const text = await this.generate(project, content, order, latest, null);
    await this.saveVersion(projectId, order, text, null);
    return this.state(projectId);
  }

  async refine(projectId: string, order: number, feedback: string): Promise<WriterState> {
    const project = await this.projects.assertStatus(projectId, ['writing']);
    const { content } = await this.projects.latestPlan(projectId);
    const latest = await this.latestVersions(projectId);
    const current = this.requireDraft(latest, order);
    const text = await this.generate(project, content, order, latest, { feedback, currentText: current.text });
    await this.saveVersion(projectId, order, text, feedback);
    return this.state(projectId);
  }

  async saveManual(projectId: string, order: number, text: string): Promise<WriterState> {
    await this.projects.assertStatus(projectId, ['writing']);
    this.requireDraft(await this.latestVersions(projectId), order);
    await this.saveVersion(projectId, order, text, 'manual edit');
    return this.state(projectId);
  }

  async fullScriptText(projectId: string): Promise<{ fullText: string }> {
    await this.projects.assertStatus(projectId, ['research_approved', 'writing']);
    const { content } = await this.projects.latestPlan(projectId);
    const latest = await this.latestVersions(projectId);
    const chapters = content.chapters
      .map((c) => {
        const text = latest.get(c.order)?.text ?? '';
        return text.trim() ? { order: c.order, title: c.title, text } : null;
      })
      .filter((c): c is { order: number; title: string; text: string } => c !== null);
    return { fullText: formatFullScript(chapters) };
  }

  async saveFullScript(projectId: string, fullText: string): Promise<WriterState> {
    await this.projects.assertStatus(projectId, ['writing']);
    const { content } = await this.projects.latestPlan(projectId);
    const latest = await this.latestVersions(projectId);
    const parsed = parseFullScript(fullText);
    if (!parsed.size) throw conflict('No chapter headings found. Use "## Chapter N: Title" sections.');
    for (const [order, text] of parsed) {
      if (!content.chapters.some((c) => c.order === order)) throw conflict(`Chapter ${order} is not in the plan`);
      if (!latest.get(order)) throw conflict(`Chapter ${order} has not been written yet`);
      await this.saveVersion(projectId, order, text, 'full script edit');
    }
    return this.state(projectId);
  }

  async refineSnippet(projectId: string, fragment: string, instructions: string): Promise<{ text: string }> {
    const project = await this.projects.assertStatus(projectId, ['writing']);
    const { data } = await this.llm.completeStructured({
      promptName: 'writer_snippet_refine',
      stageId: 'writer_refine',
      projectId,
      system: await this.composer.single('writer_snippet_refine'),
      user: { language: project.language, fragment, instructions },
      schema: writerSnippetSchema,
    });
    return { text: data.text };
  }

  /** Approval unlocks the next chapter and stores continuity later chapters see (REQUIREMENTS 5.5–5.7). */
  async approve(projectId: string, order: number): Promise<WriterState> {
    const project = await this.projects.assertStatus(projectId, ['writing']);
    const current = this.requireDraft(await this.latestVersions(projectId), order);
    const { data } = await this.llm.completeStructured({
      promptName: 'chapter_summary',
      stageId: 'chapter_summary',
      projectId,
      system: await this.composer.single('chapter_summary'),
      user: { language: project.language, chapterOrder: order, text: current.text },
      schema: chapterSummarySchema,
    });
    await this.prisma.scriptChapter.update({
      where: { id: current.id },
      data: { status: 'approved', summary: serializeContinuity(data) },
    });
    return this.state(projectId);
  }

  /** Finished script goes to My Videos (REQUIREMENTS 5.9) and becomes a duplicate guard for Advice. */
  async finalize(projectId: string) {
    const project = await this.projects.assertStatus(projectId, ['writing']);
    const { content } = await this.projects.latestPlan(projectId);
    const latest = await this.latestVersions(projectId);
    if (nextWritableChapter(content.chapters.length, approvedOrders(latest)) !== null) {
      throw conflict('Approve every chapter before finishing the script');
    }
    const markdown = buildScriptMarkdown(this.exportShape(project, content, latest));
    const fullText = content.chapters.map((c) => latest.get(c.order)?.text ?? '').join('\n\n');
    const scriptWarnings = checkScriptIntegrity({
      fullText,
      targetDurationMin: project.targetDurationMin,
    }).map((i) => i.message);
    if (scriptWarnings.some((w) => w.includes('appears twice'))) {
      throw conflict(`Script integrity check failed: ${scriptWarnings.join(' ')}`);
    }
    const summaries = content.chapters.map((c) => ({ order: c.order, title: c.title, summary: latest.get(c.order)!.summary }));
    const myVideo = await this.prisma.myVideo.create({
      data: {
        projectId,
        title: project.title,
        language: project.language,
        durationMin: project.targetDurationMin,
        topic: project.topic ?? project.title,
        subtopic: project.subtopic,
        genreId: project.genreId,
        chaptersJson: summaries,
        scriptText: markdown,
      },
    });
    const vector = await this.llm.embedOne([project.title, project.topic, ...summaries.map((s) => s.summary)].filter(Boolean).join('\n'), projectId);
    await this.embeddings.setMyVideoEmbedding(myVideo.id, vector);
    await this.projects.transition(projectId, 'done');
    return { myVideoId: myVideo.id, scriptWarnings };
  }

  async exportMarkdown(projectId: string): Promise<string> {
    const project = await this.projects.load(projectId);
    const { content } = await this.projects.latestPlan(projectId);
    return buildScriptMarkdown(this.exportShape(project, content, await this.latestVersions(projectId)));
  }

  private continuityFromApproved(latest: Map<number, ScriptChapter>, beforeOrder: number) {
    const rows = [...latest.values()]
      .filter((r) => r.status === 'approved' && r.chapterOrder < beforeOrder)
      .sort((a, b) => a.chapterOrder - b.chapterOrder)
      .map((r) => parseContinuity(r.summary))
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return mergeContinuityForWriter(rows);
  }

  private async generate(
    project: Project,
    plan: PlanContent,
    order: number,
    latest: Map<number, ScriptChapter>,
    refine: { feedback: string; currentText: string } | null,
  ): Promise<string> {
    const chapter = plan.chapters.find((c) => c.order === order)!;
    const facts = await this.prisma.researchFact.findMany({
      where: { projectId: project.id, planChapterOrder: order },
      select: { id: true, text: true, sourceUrl: true, relatedFacts: true },
    });
    const useDatabase = await this.dbTools.shouldUse(refine?.feedback ?? '', project.useDatabase);
    const continuity = this.continuityFromApproved(latest, order);
    const targetWords = targetWordsForChapter(chapter.lengthMin);
    const { data } = await this.llm.completeStructured({
      promptName: refine ? 'writer_refine' : 'writer',
      stageId: refine ? 'writer_refine' : 'writer',
      projectId: project.id,
      system: await this.composer.writer(projectContext(project), { refine: !!refine, useDatabase }),
      user: {
        overview: {
          title: project.title,
          topic: project.topic,
          language: project.language,
          targetDurationMin: project.targetDurationMin,
          riddle: plan.riddle,
          narrativeFramework: plan.narrativeFramework,
          recurringCast: plan.recurringCast,
          outline: plan.chapters.map((c) => ({ order: c.order, title: c.title, startMin: c.startMin, lengthMin: c.lengthMin })),
        },
        chapter: {
          ...chapter,
          targetWords,
          buildsOn: chapter.buildsOn ?? '',
          doNotRepeat: chapter.doNotRepeat ?? [],
        },
        facts,
        continuity,
        ...(refine ? { currentText: refine.currentText, feedback: refine.feedback } : {}),
      },
      schema: writerChapterSchema,
      tools: useDatabase ? this.dbTools.toolSet() : undefined,
    });
    return data.chapterText;
  }

  private async saveVersion(projectId: string, order: number, text: string, feedback: string | null) {
    const last = await this.prisma.scriptChapter.findFirst({ where: { projectId, chapterOrder: order }, orderBy: { version: 'desc' } });
    await this.prisma.scriptChapter.create({
      data: { projectId, chapterOrder: order, version: (last?.version ?? 0) + 1, text, feedback, status: 'draft' },
    });
  }

  private requireDraft(latest: Map<number, ScriptChapter>, order: number): ScriptChapter {
    const row = latest.get(order);
    if (!row) throw conflict(`Chapter ${order} has not been written yet`);
    if (row.status === 'approved') throw conflict(`Chapter ${order} is already approved`);
    return row;
  }

  private async latestVersions(projectId: string): Promise<Map<number, ScriptChapter>> {
    const rows = await this.prisma.scriptChapter.findMany({ where: { projectId }, orderBy: { version: 'asc' } });
    return new Map(rows.map((r) => [r.chapterOrder, r]));
  }

  private exportShape(project: Project, plan: PlanContent, latest: Map<number, ScriptChapter>) {
    return {
      title: project.title,
      targetDurationMin: project.targetDurationMin,
      riddle: plan.riddle.question,
      chapters: plan.chapters.map((c) => ({ order: c.order, title: c.title, startMin: c.startMin, text: latest.get(c.order)?.text ?? null })),
    };
  }
}

const approvedOrders = (latest: Map<number, ScriptChapter>) =>
  new Set([...latest.values()].filter((r) => r.status === 'approved').map((r) => r.chapterOrder));
