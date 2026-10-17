import { Injectable } from '@nestjs/common';
import { planContentSchema, type PlanContent, type WorkspaceCatalog } from '@youtube-ai-tool/shared';
import { orNotFound } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(): Promise<WorkspaceCatalog> {
    const [plans, research, scripts] = await Promise.all([this.listPlans(), this.listResearch(), this.listScripts()]);
    return { plans, research, scripts };
  }

  async planDetail(planVersionId: string) {
    const row = orNotFound(
      await this.prisma.planVersion.findUnique({
        where: { id: planVersionId },
        include: { project: { select: { id: true, title: true } } },
      }),
      'Plan version',
    );
    const content = planContentSchema.parse(row.content);
    return {
      id: row.id,
      projectId: row.projectId,
      projectTitle: row.project.title,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      chapterCount: content.chapters.length,
      targetDurationMin: content.targetDurationMin,
      content,
      feedback: row.feedback,
    };
  }

  async researchDetail(projectId: string) {
    const project = orNotFound(
      await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true, title: true } }),
      'Project',
    );
    const facts = await this.prisma.researchFact.findMany({
      where: { projectId },
      orderBy: [{ planChapterOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, planChapterOrder: true, text: true, sourceUrl: true, sourceTitle: true },
    });
    return { projectId: project.id, projectTitle: project.title, facts };
  }

  async scriptDetail(projectId: string) {
    const project = orNotFound(
      await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true, title: true, updatedAt: true } }),
      'Project',
    );
    const mine = await this.prisma.myVideo.findUnique({ where: { projectId } });
    if (mine) {
      return {
        id: mine.id,
        projectId,
        projectTitle: project.title,
        title: mine.title,
        status: 'finished' as const,
        text: mine.scriptText,
        updatedAt: mine.finishedAt.toISOString(),
      };
    }
    const text = await this.draftScriptText(projectId);
    const latest = await this.prisma.scriptChapter.findFirst({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return {
      id: `draft:${projectId}`,
      projectId,
      projectTitle: project.title,
      title: project.title,
      status: 'draft' as const,
      text,
      updatedAt: (latest?.updatedAt ?? project.updatedAt).toISOString(),
    };
  }

  private async listPlans() {
    const rows = await this.prisma.planVersion.findMany({
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true } } },
    });
    return rows.map((row) => {
      const content = row.content as PlanContent;
      return {
        id: row.id,
        projectId: row.projectId,
        projectTitle: row.project.title,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        chapterCount: content.chapters?.length ?? 0,
        targetDurationMin: content.targetDurationMin ?? 0,
      };
    });
  }

  private async listResearch() {
    const facts = await this.prisma.researchFact.findMany({
      select: { projectId: true, planChapterOrder: true, createdAt: true, project: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const byProject = new Map<
      string,
      { projectTitle: string; factCount: number; chapters: Set<number>; updatedAt: Date }
    >();
    for (const f of facts) {
      let row = byProject.get(f.projectId);
      if (!row) {
        row = { projectTitle: f.project.title, factCount: 0, chapters: new Set(), updatedAt: f.createdAt };
        byProject.set(f.projectId, row);
      }
      row.factCount++;
      row.chapters.add(f.planChapterOrder);
      if (f.createdAt > row.updatedAt) row.updatedAt = f.createdAt;
    }
    return [...byProject.entries()]
      .map(([projectId, r]) => ({
        projectId,
        projectTitle: r.projectTitle,
        factCount: r.factCount,
        chapterCount: r.chapters.size,
        updatedAt: r.updatedAt.toISOString(),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async listScripts() {
    const [finished, chapterGroups] = await Promise.all([
      this.prisma.myVideo.findMany({
        orderBy: { finishedAt: 'desc' },
        select: { id: true, projectId: true, title: true, scriptText: true, finishedAt: true, project: { select: { title: true } } },
      }),
      this.prisma.scriptChapter.groupBy({
        by: ['projectId'],
        _max: { updatedAt: true },
      }),
    ]);
    const finishedProjects = new Set(finished.map((f) => f.projectId));
    const drafts = chapterGroups.filter((g) => !finishedProjects.has(g.projectId));
    const draftProjects = drafts.length
      ? await this.prisma.project.findMany({
          where: { id: { in: drafts.map((d) => d.projectId) } },
          select: { id: true, title: true, updatedAt: true },
        })
      : [];
    const draftById = new Map(draftProjects.map((p) => [p.id, p]));

    const draftItems = (
      await Promise.all(
        drafts.map(async (g) => {
          const project = draftById.get(g.projectId);
          if (!project) return null;
          const text = await this.draftScriptText(g.projectId);
          return {
            id: `draft:${g.projectId}`,
            projectId: g.projectId,
            projectTitle: project.title,
            title: project.title,
            status: 'draft' as const,
            updatedAt: (g._max.updatedAt ?? project.updatedAt).toISOString(),
            wordCount: wordCount(text),
          };
        }),
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null);

    const finishedItems = finished.map((f) => ({
      id: f.id,
      projectId: f.projectId,
      projectTitle: f.project.title,
      title: f.title,
      status: 'finished' as const,
      updatedAt: f.finishedAt.toISOString(),
      wordCount: wordCount(f.scriptText),
    }));

    return [...finishedItems, ...draftItems].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async draftScriptText(projectId: string): Promise<string> {
    const rows = await this.prisma.scriptChapter.findMany({
      where: { projectId },
      orderBy: [{ chapterOrder: 'asc' }, { version: 'desc' }],
    });
    const latest = new Map<number, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latest.has(row.chapterOrder)) latest.set(row.chapterOrder, row);
    }
    return [...latest.values()]
      .sort((a, b) => a.chapterOrder - b.chapterOrder)
      .map((c) => c.text.trim())
      .filter(Boolean)
      .join('\n\n');
  }
}
