import { adviceRunStoredSchema, type AdviceRunStored, type AdviceTopic } from '@youtube-ai-tool/shared';
import type { AdviceRun } from '@prisma/client';

export type LegacyAdviceProject = { title: string; topic: string | null };

/** Matches a project row to one Advice topic (short `topic` label or long `title`). */
export function inferAdviceTopicIndex(topics: AdviceTopic[], project: LegacyAdviceProject): number | null {
  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    const labels = [t.topic, t.title];
    if (project.topic && labels.includes(project.topic)) return i;
    if (labels.includes(project.title)) return i;
  }
  return null;
}

/**
 * Normalizes stored JSON. Legacy runs only stored AdviceRun.projectId (one project per run).
 * Never default that id to topic 0 — infer the topic from project title/topic when possible.
 */
export function parseAdviceRunResults(
  run: Pick<AdviceRun, 'results' | 'projectId'>,
  legacyProject?: LegacyAdviceProject | null,
): AdviceRunStored {
  const stored = adviceRunStoredSchema.parse(run.results);
  if (Object.keys(stored.topicProjects).length) return stored;
  if (!run.projectId || !legacyProject) return stored;
  const idx = inferAdviceTopicIndex(stored.topics, legacyProject);
  if (idx === null) return stored;
  return { ...stored, topicProjects: { [String(idx)]: run.projectId } };
}

export function adviceTopicProjectName(topic: AdviceTopic): string {
  return topic.topic.trim() || topic.title.trim();
}

/** Re-map each linked project id to the Advice topic it actually matches (fixes legacy topic 0 bugs). */
export function reconcileTopicProjects(
  stored: AdviceRunStored,
  projectIds: Iterable<string>,
  projectsById: Map<string, LegacyAdviceProject>,
): AdviceRunStored {
  const ids = new Set([...Object.values(stored.topicProjects), ...projectIds]);
  const topicProjects: Record<string, string> = {};
  for (const pid of ids) {
    const project = projectsById.get(pid);
    if (!project) continue;
    const idx = inferAdviceTopicIndex(stored.topics, project);
    if (idx === null) continue;
    topicProjects[String(idx)] = pid;
  }
  return { ...stored, topicProjects };
}
