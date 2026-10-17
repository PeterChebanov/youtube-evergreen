import type { ProjectStatus } from '@youtube-ai-tool/shared';
import type { Nav } from './stores';
import type { ProjectStore } from './stores';

export const PROJECT_SCREEN = {
  draft: 'plan',
  planning: 'plan',
  plan_approved: 'facts',
  researching: 'facts',
  research_approved: 'writer',
  writing: 'writer',
  done: 'videos',
} as const satisfies Record<ProjectStatus, string>;

export function enterProject(projects: ProjectStore, nav: Nav, projectId: string, status: ProjectStatus | null | undefined) {
  projects.select(projectId);
  void projects.reload(projectId);
  nav.go(status ? PROJECT_SCREEN[status] : 'plan');
}
