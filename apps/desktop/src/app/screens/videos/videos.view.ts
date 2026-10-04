import type { MyVideoItem, ProjectDto } from '../../core/api.types';
import { formatDate, minutesClock } from '../../core/format';

export type ScriptRow = {
  key: string;
  projectId: string;
  title: string;
  sub: string;
  project: string;
  length: string;
  finished: boolean;
};

const IN_PROGRESS: ReadonlyArray<ProjectDto['status']> = ['planning', 'plan_approved', 'researching', 'research_approved', 'writing'];

const STAGE: Record<string, string> = {
  planning: 'planning',
  plan_approved: 'researching facts',
  researching: 'researching facts',
  research_approved: 'ready to write',
  writing: 'writing',
};

/** Finished scripts first, then projects still in progress as drafts (DESIGN_SPEC 6.8). */
export function scriptRows(videos: MyVideoItem[], projects: ProjectDto[]): ScriptRow[] {
  const finished = videos.map((v) => ({
    key: v.id,
    projectId: v.projectId,
    title: v.title,
    sub: `Finished ${formatDate(v.finishedAt)} · ${v.language.toUpperCase()}`,
    project: v.project?.title ?? v.topic,
    length: v.durationMin ? minutesClock(v.durationMin) : '—',
    finished: true,
  }));
  const drafts = projects
    .filter((p) => IN_PROGRESS.includes(p.status))
    .map((p) => ({
      key: p.id,
      projectId: p.id,
      title: p.title,
      sub: `Draft · ${STAGE[p.status] ?? p.status} · ${p.language.toUpperCase()}`,
      project: p.topic ?? p.title,
      length: '—',
      finished: false,
    }));
  return [...finished, ...drafts];
}
