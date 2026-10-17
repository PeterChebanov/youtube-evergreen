import { Injectable } from '@nestjs/common';
import { transcriptAnalysisSchema, type TranscriptAnalysis } from '@youtube-ai-tool/shared';
import type { Project } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PromptName } from '../llm/prompt-names';
import { AuthorOverlay, buildLayers, ChannelVoice, renderLayers } from './prompt-layers';
import {
  DB_PRIORITY_FILE,
  FACT_GEOGRAPHY_FILE,
  FACT_RECENCY_FILE,
  NARRATIVE_EDITORIAL_FILE,
  NARRATIVE_GEOGRAPHY_GLOBAL_FILE,
  PromptsService,
  RETENTION_BASE_FILE,
} from './prompts.service';

export type ProjectContext = {
  genreId: string | null;
  authorOverlayChannelId?: string | null;
  toneReferenceVideoIds?: string[];
};

export function projectContext(project: Pick<Project, 'genreId' | 'authorOverlayChannelId' | 'toneReferenceVideoIds'>): ProjectContext {
  return {
    genreId: project.genreId,
    authorOverlayChannelId: project.authorOverlayChannelId,
    toneReferenceVideoIds: project.toneReferenceVideoIds,
  };
}

/** Assembles system prompts from prompt files and DB-held style/genre layers. */
@Injectable()
export class PromptComposer {
  constructor(
    private readonly prompts: PromptsService,
    private readonly prisma: PrismaService,
  ) {}

  async single(name: PromptName): Promise<string> {
    return renderLayers(buildLayers({ base: [await this.prompts.forPrompt(name)] }));
  }

  async advice(genreIds: string[]): Promise<string> {
    const genres = genreIds.length
      ? await this.prisma.genre.findMany({ where: { id: { in: genreIds } }, select: { name: true, promptModule: true, focus: true } })
      : [];
    return renderLayers(
      buildLayers({
        base: [await this.prompts.forPrompt('advice')],
        genreModule: genres.map((g) => `${g.name}: ${g.promptModule ?? g.focus}`).join('\n') || null,
        dbPriority: await this.prompts.file(DB_PRIORITY_FILE),
      }),
    );
  }

  async planning(project: ProjectContext, useDatabase: boolean): Promise<string> {
    return renderLayers(
      buildLayers({
        base: [await this.prompts.forPrompt('planning')],
        retentionBase: await this.prompts.file(RETENTION_BASE_FILE),
        channelStyle: await this.channelVoice(),
        genreModule: await this.genreModule(project.genreId),
        dbPriority: await this.dbPriority(useDatabase),
        narrativeEditorial: await this.prompts.file(NARRATIVE_EDITORIAL_FILE),
        narrativeGeographyLock: await this.prompts.file(NARRATIVE_GEOGRAPHY_GLOBAL_FILE),
        factGeography: await this.prompts.file(FACT_GEOGRAPHY_FILE),
      }),
    );
  }

  async research(
    name: 'research_queries' | 'fact_extract',
    project: ProjectContext,
    useDatabase: boolean,
    opts?: { factGeography?: boolean; factRecency?: boolean },
  ) {
    return renderLayers(
      buildLayers({
        base: [await this.prompts.forPrompt(name)],
        genreModule: await this.genreModule(project.genreId),
        dbPriority: await this.dbPriority(useDatabase),
        factGeography: opts?.factGeography ? await this.prompts.file(FACT_GEOGRAPHY_FILE) : null,
        factRecency: opts?.factRecency ? await this.prompts.file(FACT_RECENCY_FILE) : null,
        narrativeEditorial: await this.prompts.file(NARRATIVE_EDITORIAL_FILE),
        narrativeGeographyLock: await this.prompts.file(NARRATIVE_GEOGRAPHY_GLOBAL_FILE),
      }),
    );
  }

  async writer(project: ProjectContext, opts: { refine: boolean; useDatabase: boolean }): Promise<string> {
    const base = [await this.prompts.forPrompt('writer')];
    if (opts.refine) base.push(await this.prompts.forPrompt('writer_refine'));
    return renderLayers(
      buildLayers({
        base,
        retentionBase: await this.prompts.file(RETENTION_BASE_FILE),
        channelStyle: await this.channelVoice(),
        genreModule: await this.genreModule(project.genreId),
        overlay: await this.overlay(project.authorOverlayChannelId),
        toneReferences: await this.toneReferences(project.toneReferenceVideoIds ?? []),
        dbPriority: await this.dbPriority(opts.useDatabase),
        narrativeEditorial: await this.prompts.file(NARRATIVE_EDITORIAL_FILE),
        narrativeGeographyLock: await this.prompts.file(NARRATIVE_GEOGRAPHY_GLOBAL_FILE),
      }),
    );
  }

  private async channelVoice(): Promise<ChannelVoice | null> {
    const style = await this.prisma.channelStyle.findFirst({ orderBy: { version: 'desc' } });
    if (!style) return null;
    const techniques = Array.isArray(style.techniques) ? (style.techniques as ChannelVoice['techniques']) : [];
    return { voice: style.voice, themes: style.themes, techniques, retentionRules: style.retentionRules };
  }

  private async genreModule(genreId: string | null): Promise<string | null> {
    if (!genreId) return null;
    const genre = await this.prisma.genre.findUnique({ where: { id: genreId } });
    if (!genre) return null;
    return [genre.promptModule ?? `Lean towards: ${genre.focus}`, genre.retentionBestPractices].filter(Boolean).join('\n\n');
  }

  private async overlay(channelId: string | null | undefined): Promise<AuthorOverlay | null> {
    if (!channelId) return null;
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { authorStyles: { orderBy: { order: 'asc' } } },
    });
    return channel ? { channelName: channel.channelName, techniques: channel.authorStyles } : null;
  }

  private async toneReferences(videoIds: string[]): Promise<TranscriptAnalysis[]> {
    if (!videoIds.length) return [];
    const rows = await this.prisma.videoAnalysis.findMany({
      where: { videoId: { in: videoIds } },
      select: { transcriptAnalysis: true },
    });
    return rows.flatMap((r) => {
      const parsed = transcriptAnalysisSchema.safeParse(r.transcriptAnalysis);
      return parsed.success ? [parsed.data] : [];
    });
  }

  private async dbPriority(useDatabase: boolean): Promise<string | null> {
    return useDatabase ? this.prompts.file(DB_PRIORITY_FILE) : null;
  }
}
