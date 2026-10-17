import { Injectable } from '@nestjs/common';
import {
  LLM_STAGE_IDS,
  SEARCH_PROVIDER_IDS,
  adviceFiltersSchema,
  adviceRunStoredSchema,
  type AdviceRunStored,
  canTransition,
  channelUrl,
  planContentSchema,
  type CustomRequest,
  type PlanContent,
  type ProjectDto,
  type LlmStageId,
  type ProjectStatus,
  type SearchProviderId,
  type UpdateProjectRequest,
} from '@youtube-ai-tool/shared';
import type { AdviceRun, Prisma, Project } from '@prisma/client';
import { conflict, DomainError, invalid, orNotFound } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { DbToolsService } from '../db-tools/db-tools.service';
import { adviceTopicProjectName, parseAdviceRunResults, reconcileTopicProjects } from '../advice/advice-run-results';
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
    searchProviders: parseSearchProviders(p.searchProviders),
    llmModelOverrides: parseLlmOverrides(p.llmModelOverrides),
  };
}

function parseLlmOverrides(raw: unknown): ProjectDto['llmModelOverrides'] {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<LlmStageId, string>> = {};
  for (const id of LLM_STAGE_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === 'string' && v.trim()) out[id] = v.trim();
  }
  return out;
}

function parseSearchProviders(values: string[]): SearchProviderId[] {
  const allowed = new Set<string>(SEARCH_PROVIDER_IDS);
  return values.filter((v): v is SearchProviderId => allowed.has(v));
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
    const stored = await this.resolveAdviceRunStored(run);
    await this.persistAdviceTopicProjectsIfLegacy(run.id, run.results, stored);
    if (stored.topicProjects[String(topicIndex)]) throw conflict('This Advice topic is already linked to a project');
    const topic = stored.topics[topicIndex];
    if (!topic) throw invalid(`Topic index ${topicIndex} is out of range`);
    const filters = adviceFiltersSchema.parse(run.filters);
    const genre = topic.genre ? await this.prisma.genre.findFirst({ where: { name: { equals: topic.genre, mode: 'insensitive' } } }) : null;
    const project = await this.prisma.project.create({
      data: {
        title: adviceTopicProjectName(topic).slice(0, TITLE_MAX),
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
    const topicProjects = { ...stored.topicProjects, [String(topicIndex)]: project.id };
    await this.prisma.adviceRun.update({
      where: { id: runId },
      data: { projectId: run.projectId ?? project.id, results: { ...stored, topicProjects } },
    });
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
    if (patch.searchProviders) {
      const bad = patch.searchProviders.filter((id) => !SEARCH_PROVIDER_IDS.includes(id));
      if (bad.length) throw invalid(`Unknown search provider: ${bad.join(', ')}`);
    }
    if (patch.llmModelOverrides !== undefined && patch.llmModelOverrides !== null) {
      for (const key of Object.keys(patch.llmModelOverrides)) {
        if (!LLM_STAGE_IDS.includes(key as LlmStageId)) {
          throw invalid(`Unknown LLM stage: ${key}`);
        }
      }
    }
    if (project.status === 'done') throw conflict('A finished project can no longer be changed');
    const data = (
      patch.llmModelOverrides === null ? { ...patch, llmModelOverrides: {} } : patch
    ) as Prisma.ProjectUpdateInput;
    return toProjectDto(await this.prisma.project.update({ where: { id }, data }));
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
    const runs = await this.prisma.adviceRun.findMany({ select: { id: true, projectId: true, results: true } });
    const runUpdates: Prisma.PrismaPromise<unknown>[] = [];
    for (const run of runs) {
      const raw = adviceRunStoredSchema.safeParse(run.results);
      if (!raw.success) continue;
      const topicProjects = Object.fromEntries(
        Object.entries(raw.data.topicProjects).filter(([, pid]) => pid !== id),
      );
      const changed =
        run.projectId === id ||
        Object.keys(topicProjects).length !== Object.keys(raw.data.topicProjects).length;
      if (!changed) continue;
      runUpdates.push(
        this.prisma.adviceRun.update({
          where: { id: run.id },
          data: {
            projectId: run.projectId === id ? null : run.projectId,
            results: { ...raw.data, topicProjects },
          },
        }),
      );
    }
    await this.prisma.$transaction([...runUpdates, this.prisma.project.delete({ where: { id } })]);
  }

  private async resolveAdviceRunStored(run: Pick<AdviceRun, 'results' | 'projectId'>) {
    const raw = adviceRunStoredSchema.parse(run.results);
    const ids = new Set([...Object.values(raw.topicProjects), ...(run.projectId ? [run.projectId] : [])]);
    const projects = ids.size
      ? await this.prisma.project.findMany({
          where: { id: { in: [...ids] } },
          select: { id: true, title: true, topic: true },
        })
      : [];
    const byId = new Map(projects.map((p) => [p.id, p]));
    const legacy = run.projectId ? byId.get(run.projectId) ?? null : null;
    const parsed = parseAdviceRunResults(run, legacy);
    return reconcileTopicProjects(parsed, ids, byId);
  }

  /** Persist repaired topicProjects when legacy JSON disagrees with project rows. */
  private async persistAdviceTopicProjectsIfLegacy(runId: string, rawResults: unknown, resolved: AdviceRunStored) {
    const raw = adviceRunStoredSchema.safeParse(rawResults);
    if (!raw.success) return;
    if (JSON.stringify(raw.data.topicProjects) === JSON.stringify(resolved.topicProjects)) return;
    await this.prisma.adviceRun.update({
      where: { id: runId },
      data: { results: { ...raw.data, topicProjects: resolved.topicProjects } },
    });
  }

  private async startChannelResearch(youtubeChannelId: string) {
    try {
      await this.research.start(channelUrl(youtubeChannelId));
    } catch (e) {
      if (!(e instanceof DomainError && e.code === 'conflict')) throw e;
    }
  }
}
