export const PROJECT_STATUSES = [
  'draft',
  'planning',
  'plan_approved',
  'researching',
  'research_approved',
  'writing',
  'done',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Forward-only pipeline: each step starts only by the author's explicit action. */
const NEXT: Record<ProjectStatus, ProjectStatus | null> = {
  draft: 'planning',
  planning: 'plan_approved',
  plan_approved: 'researching',
  researching: 'research_approved',
  research_approved: 'writing',
  writing: 'done',
  done: null,
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return NEXT[from] === to;
}

export function hasReached(status: ProjectStatus, target: ProjectStatus): boolean {
  return PROJECT_STATUSES.indexOf(status) >= PROJECT_STATUSES.indexOf(target);
}

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}
