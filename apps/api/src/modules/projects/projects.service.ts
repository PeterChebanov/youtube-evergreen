import { Injectable } from '@nestjs/common';
import {
  adviceFiltersSchema,
  adviceRunResultSchema,
  canTransition,
  channelUrl,
  planContentSchema,
  type CustomRequest,
  type PlanContent,
  type ProjectDto,
  type ProjectStatus,
  type UpdateProjectRequest,
} from '@youtube-ai-tool/shared';
import type { Project } from '@prisma/client';
import { conflict, DomainError, invalid, orNotFound } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { DbToolsService } from '../db-tools/db-tools.service';
import { ResearchService } from '../library/research.service';
import { SingleVideoService } from '../library/single-video.service';

const TITLE_MAX = 90;

export function toProjectDto(p: Project): ProjectDto {
  return {
    id: p.id,
    title: p.title,
    entryType: p.entryType as ProjectDto['entryType'],
    status: p.status as ProjectStatus,
    language: p.language as ProjectDto['language'],
    targetDurationMin: p.targetDurationMin,
    genreId: p.genreId,
    authorOverlayChannelId: p.authorOverlayChannelId,
    toneReferenceVideoIds: p.toneReferenceVideoIds,
    useDatabase: p.useDatabase,
    topic: p.topic,
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dbTools: DbToolsService,
    private readonly singleVideo: SingleVideoService,
    private readonly research: ResearchService,
  ) {}

  async list(): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({ orderBy: { updatedAt: 'desc' } });
    return projects.map(toProjectDto);
  }

  async get(id: string): Promise<ProjectDto> {
    return toProjectDto(await this.load(id));
  }

  async load(id: string): Promise<Project> {
    return orNotFound(await this.prisma.project.findUnique({ where: { id } }), 'Project');
  }

  /** Project from one of the three Advice topics (REQUIREMENTS 2.10). */
  async createFromAdvice(runId: string, topicIndex: number): Promise<ProjectDto> {
    const run = orNotFound(await this.prisma.adviceRun.findUnique({ where: { id: runId } }), 'Advice run');
    if (run.projectId) throw conflict('A topic from this Advice run was already taken into a project');
    const topic = adviceRunResultSchema.omit({ runId: true }).parse(run.results).topics[topicIndex];
    const filters = adviceFiltersSchema.parse(run.filters);
    const genre = topic.genre ? await this.prisma.genre.findFirst({ where: { name: { equals: topic.genre, mode: 'insensitive' } } }) : null;
    const project = await this.prisma.project.create({
      data: {
        title: topic.title.slice(0, TITLE_MAX),
        entryType: 'advice',
        language: filters.language,
        targetDurationMin: filters.targetDurationMin,
        genreId: genre?.id ?? filters.genreIds[0] ?? null,
        topic: topic.topic,
        subtopic: topic.subtopic ?? null,
        sourceVideoIds: topic.sourceVideoIds,
        useDatabase: true,
      },
    });
    await this.prisma.adviceRun.update({ where: { id: runId }, data: { projectId: project.id } });
    return toProjectDto(project);
  }

  /** Author's own request (REQUIREMENTS 2.12–2.14): the library is used only when asked. */
  async createFromCustomRequest(req: CustomRequest): Promise<ProjectDto> {
    const useDatabase = await this.dbTools.shouldUse(req.request, req.useDatabase);
    let sourceVideoIds: string[] = [];
    let sourceVideoSnapshot: object | null = null;
    if (req.videoUrl) {
      const snap = await this.singleVideo.snapshot(req.videoUrl);
      if (snap.inLibrary) sourceVideoIds = [snap.videoId];
      else sourceVideoSnapshot = snap;
      if (req.researchChannelIntoDb) await this.startChannelResearch(snap.youtubeChannelId);
    }
    const project = await this.prisma.project.create({
      data: {
        title: (req.title || req.request).replace(/\s+/g, ' ').slice(0, TITLE_MAX),
        entryType: 'own_request',
        language: req.language,
        targetDurationMin: req.targetDurationMin,
        genreId: req.genreId,
        topic: req.request,
        useDatabase,
        sourceVideoIds,
        ...(sourceVideoSnapshot ? { sourceVideoSnapshot } : {}),
      },
    });
    return toProjectDto(project);
  }

  async update(id: string, patch: UpdateProjectRequest): Promise<ProjectDto> {
    const project = await this.load(id);
    if (patch.toneReferenceVideoIds?.length) {
      const ready = await this.prisma.videoAnalysis.count({
        where: { videoId: { in: patch.toneReferenceVideoIds }, transcriptAnalyzedAt: { not: null } },
      });
      if (ready !== new Set(patch.toneReferenceVideoIds).size) throw invalid('Tone references must be videos with analysed subtitles');
    }
    if (patch.authorOverlayChannelId) {
      const styles = await this.prisma.authorStyle.count({ where: { channelId: patch.authorOverlayChannelId } });
      if (!styles) throw invalid('The overlay channel has no researched techniques');
    }
    if (patch.genreId) orNotFound(await this.prisma.genre.findUnique({ where: { id: patch.genreId } }), 'Genre');
    if (project.status === 'done') throw conflict('A finished project can no longer be changed');
    return toProjectDto(await this.prisma.project.update({ where: { id }, data: patch }));
  }

  async transition(id: string, to: ProjectStatus): Promise<Project> {
    const project = await this.load(id);
    if (project.status === to) return project;
    if (!canTransition(project.status as ProjectStatus, to)) {
      throw conflict(`Project is ${project.status}; it cannot move to ${to}`);
    }
    return this.prisma.project.update({ where: { id }, data: { status: to } });
  }

  async assertStatus(id: string, allowed: ProjectStatus[]): Promise<Project> {
    const project = await this.load(id);
    if (!allowed.includes(project.status as ProjectStatus)) {
      throw conflict(`Project is ${project.status}; this step needs ${allowed.join(' or ')}`);
    }
    return project;
  }

  async latestPlan(projectId: string): Promise<{ version: number; content: PlanContent }> {
    const plan = await this.prisma.planVersion.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
    if (!plan) throw conflict('This project has no plan yet');
    return { version: plan.version, content: planContentSchema.parse(plan.content) };
  }

  async remove(id: string) {
    await this.load(id);
    await this.prisma.$transaction([
      this.prisma.adviceRun.updateMany({ where: { projectId: id }, data: { projectId: null } }),
      this.prisma.project.delete({ where: { id } }),
    ]);
  }

  private async startChannelResearch(youtubeChannelId: string) {
    try {
      await this.research.start(channelUrl(youtubeChannelId));
    } catch (e) {
      if (!(e instanceof DomainError && e.code === 'conflict')) throw e;
    }
  }
}
