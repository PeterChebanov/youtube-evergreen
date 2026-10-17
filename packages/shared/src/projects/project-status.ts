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

/** Plan outline can be edited until the writer starts. */
export const PLAN_EDIT_STATUSES = ['draft', 'planning', 'plan_approved', 'researching', 'research_approved'] as const satisfies readonly ProjectStatus[];

/** Facts can be changed until writing starts. */
export const FACT_EDIT_STATUSES = ['researching', 'research_approved'] as const satisfies readonly ProjectStatus[];

export function canEditPlan(status: ProjectStatus): boolean {
  return (PLAN_EDIT_STATUSES as readonly string[]).includes(status);
}

export function canEditFacts(status: ProjectStatus): boolean {
  return (FACT_EDIT_STATUSES as readonly string[]).includes(status);
}
