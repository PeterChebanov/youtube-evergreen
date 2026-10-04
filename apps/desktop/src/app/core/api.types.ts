import type { PlanContent, SubtitleCheck } from '@youtube-ai-tool/shared';

export type {
  AdviceFilters,
  AdviceRunResult,
  AdviceTopic,
  ChannelDetail,
  ChannelSummary,
  CustomRequest,
  FactDto,
  FactResearchState,
  OpsStatus,
  PeriodFilter,
  PlanContent,
  PlanChapter,
  ProjectDto,
  SubtitleCheck,
  TopicMemory,
  UpdateProjectRequest,
  WriterState,
} from '@youtube-ai-tool/shared';

export type ResearchPreview = {
  youtubeChannelId: string;
  channelName: string;
  videoCount: number;
  inLibrary: boolean;
  storedVideos: number;
  estimate: { videoCount: number; estimatedInputTokens: number; estimatedOutputTokens: number; estimatedUsd: number };
};

export type PlanVersion = { version: number; content: PlanContent; feedback: string | null; createdAt: string };

export type MyVideoItem = {
  id: string;
  projectId: string;
  title: string;
  language: string;
  durationMin: number | null;
  topic: string;
  finishedAt: string;
  genre: { id: string; name: string } | null;
  project: { title: string } | null;
};

export type Genre = {
  id: string;
  name: string;
  focus: string;
  status: 'approved' | 'new';
  promptModule: string | null;
  retentionBestPractices: string | null;
  topAuthors: Array<{ channelName: string }> | null;
  videoCount: number;
};

export type ChannelStyle = {
  id: string;
  version: number;
  voice: string;
  themes: string;
  techniques: Array<{ name: string; description: string }>;
  retentionRules: string;
  createdAt: string;
};

export type DbColumn = { name: string; type: string };
export type DbRow = Record<string, string | null>;
export type DbTable = { name: string; approxRows: number };
export type DbPage = { table: string; columns: DbColumn[]; rows: DbRow[]; total: number };
export type DbQuery = { sort?: string; dir?: 'asc' | 'desc'; q?: string; limit?: number; offset?: number };

export type SubtitlesFetchResult =
  | { outcome: 'confirmation_required'; confirmation: string; check: SubtitleCheck }
  | { outcome: 'saved' | 'unavailable'; check: SubtitleCheck };
