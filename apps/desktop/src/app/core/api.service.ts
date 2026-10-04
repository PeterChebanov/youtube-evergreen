import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import type {
  AdviceFilters,
  AdviceRunResult,
  ChannelDetail,
  ChannelStyle,
  ChannelSummary,
  CustomRequest,
  DbPage,
  DbQuery,
  DbTable,
  FactResearchState,
  Genre,
  MyVideoItem,
  OpsStatus,
  PlanVersion,
  ProjectDto,
  ResearchPreview,
  SubtitleCheck,
  SubtitlesFetchResult,
  TopicMemory,
  UpdateProjectRequest,
  WriterState,
} from './api.types';
import { API_URL } from './config';

/** Human-readable reason from an API or network failure. */
export function errorText(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'The local API is not reachable.';
    const message = (e.error as { message?: unknown } | null)?.message;
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string' && message) return message;
    return `${e.status} ${e.statusText}`.trim();
  }
  return e instanceof Error ? e.message : String(e);
}

/** One method per API endpoint; no state lives here. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private get<T>(path: string, params?: HttpParams) {
    return run(this.http.get<T>(API_URL + path, { params }));
  }
  private text(path: string, params?: HttpParams) {
    return run(this.http.get(API_URL + path, { params, responseType: 'text' }));
  }
  private post<T>(path: string, body: unknown = {}) {
    return run(this.http.post<T>(API_URL + path, body));
  }
  private put<T>(path: string, body: unknown) {
    return run(this.http.put<T>(API_URL + path, body));
  }
  private patch<T>(path: string, body: unknown) {
    return run(this.http.patch<T>(API_URL + path, body));
  }
  private delete<T>(path: string) {
    return run(this.http.delete<T>(API_URL + path));
  }

  opsStatus = () => this.get<OpsStatus>('/ops/status');
  searchOptions = () => this.get<import('./api.types').SearchOption[]>('/ops/search-options');
  llmDefaults = () => this.get<import('./api.types').LlmDefaults>('/ops/llm-defaults');

  researchPreview = (channelUrl: string) => this.post<ResearchPreview>('/library/research/preview', { channelUrl });
  startResearch = (channelUrl: string) => this.post<ChannelSummary>('/library/research', { channelUrl });
  retryResearch = (jobId: string) => this.post<ChannelSummary>(`/library/research-jobs/${jobId}/retry`);
  rerunChannel = (channelId: string) => this.post<ChannelSummary>(`/library/channels/${channelId}/rerun`);
  refreshViews = () => this.post<{ queued: number }>('/library/refresh');
  channels = () => this.get<ChannelSummary[]>('/library/channels');
  channel = (id: string) => this.get<ChannelDetail>(`/library/channels/${id}`);

  advice = (filters: Partial<AdviceFilters>) => this.post<AdviceRunResult>('/advice', filters);
  genres = () => this.get<Genre[]>('/genres');
  createGenre = (body: { name: string; focus: string; status?: 'approved' | 'new' }) => this.post<Genre>('/genres', body);
  updateGenre = (id: string, body: Partial<Pick<Genre, 'name' | 'focus' | 'status' | 'promptModule'>>) => this.patch<Genre>(`/genres/${id}`, body);
  deleteGenre = (id: string) => this.delete<void>(`/genres/${id}`);
  recomputeGenres = () => this.post<{ updated: number; failed: string[] }>('/genres/recompute');

  projects = () => this.get<ProjectDto[]>('/projects');
  project = (id: string) => this.get<ProjectDto>(`/projects/${id}`);
  projectFromAdvice = (runId: string, topicIndex: number) => this.post<ProjectDto>('/projects/from-advice', { runId, topicIndex });
  projectFromRequest = (body: Partial<CustomRequest> & { request: string }) => this.post<ProjectDto>('/projects/custom', body);
  updateProject = (id: string, body: UpdateProjectRequest) => this.patch<ProjectDto>(`/projects/${id}`, body);
  deleteProject = (id: string) => this.delete<void>(`/projects/${id}`);

  planVersions = (projectId: string) => this.get<PlanVersion[]>(`/projects/${projectId}/plan`);
  generatePlan = (projectId: string) => this.post<PlanVersion>(`/projects/${projectId}/plan/generate`);
  refinePlan = (projectId: string, feedback: string) => this.post<PlanVersion>(`/projects/${projectId}/plan/refine`, { feedback });
  approvePlan = (projectId: string) => this.post<unknown>(`/projects/${projectId}/plan/approve`);

  facts = (projectId: string) => this.get<FactResearchState>(`/projects/${projectId}/facts`);
  refineFacts = (projectId: string, feedback: string, chapterOrder?: number) =>
    this.post<unknown>(`/projects/${projectId}/facts/refine`, { feedback, chapterOrder });
  retryFacts = (projectId: string) => this.post<unknown>(`/projects/${projectId}/facts/retry`);
  addFact = (projectId: string, body: { planChapterOrder: number; text: string; sourceUrl: string }) =>
    this.post<unknown>(`/projects/${projectId}/facts`, body);
  deleteFact = (projectId: string, factId: string) => this.delete<void>(`/projects/${projectId}/facts/${factId}`);
  approveFacts = (projectId: string) => this.post<unknown>(`/projects/${projectId}/facts/approve`);

  script = (projectId: string) => this.get<WriterState>(`/projects/${projectId}/script`);
  writeChapter = (projectId: string, order: number) => this.post<unknown>(`/projects/${projectId}/script/chapters/${order}/write`);
  refineChapter = (projectId: string, order: number, feedback: string) =>
    this.post<unknown>(`/projects/${projectId}/script/chapters/${order}/refine`, { feedback });
  saveChapter = (projectId: string, order: number, text: string) => this.put<unknown>(`/projects/${projectId}/script/chapters/${order}`, { text });
  approveChapter = (projectId: string, order: number) => this.post<unknown>(`/projects/${projectId}/script/chapters/${order}/approve`);
  finalizeScript = (projectId: string) => this.post<unknown>(`/projects/${projectId}/script/finalize`);
  exportScript = (projectId: string) => this.text(`/projects/${projectId}/script/export`);

  checkSubtitles = (url: string) => this.post<SubtitleCheck>('/subtitles/check', { url });
  fetchSubtitles = (body: { url: string; confirmTitleMismatch?: boolean; confirmAddVideo?: boolean; confirmOverwrite?: boolean }) =>
    this.post<SubtitlesFetchResult>('/subtitles/fetch', body);
  analyzeTranscript = (videoId: string) => this.post<unknown>(`/subtitles/videos/${videoId}/analyze`);

  dbTables = () => this.get<DbTable[]>('/database/tables');
  dbRows = (table: string, query: DbQuery) => this.get<DbPage>(`/database/tables/${table}`, toParams(query));
  dbExport = (table: string, query: DbQuery) => this.text(`/database/tables/${table}/export`, toParams(query));

  myVideos = () => this.get<MyVideoItem[]>('/my-videos');
  topicMemory = () => this.get<TopicMemory>('/my-videos/memory');

  style = () => this.get<ChannelStyle | null>('/style');
  saveStyle = (body: Pick<ChannelStyle, 'voice' | 'themes' | 'techniques' | 'retentionRules'>) => this.put<ChannelStyle>('/style', body);
  draftStyle = () => this.post<ChannelStyle>('/style/draft');
}

function run<T>(request: Observable<T>): Promise<T> {
  return firstValueFrom(request);
}

function toParams(query: DbQuery): HttpParams {
  let params = new HttpParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params = params.set(k, String(v));
  return params;
}
