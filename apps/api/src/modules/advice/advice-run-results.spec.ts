import { inferAdviceTopicIndex, parseAdviceRunResults } from './advice-run-results';

const source = {
  videoId: 'v1',
  title: 'Video',
  channelName: 'Ch',
  views: 1,
  durationSec: 60,
  publishedAt: '2020-01-01T00:00:00.000Z',
  velocityPerDay: 1,
  relativeSuccess: 1,
};

const topics = [
  {
    type: 'rework' as const,
    title: 'Long title A',
    topic: 'a',
    rationale: 'r',
    sourceVideoIds: ['v1'],
    draftChapters: [{ title: 'c', subIdeas: [] }, { title: 'c2', subIdeas: [] }, { title: 'c3', subIdeas: [] }],
    riddle: 'q',
    sources: [source],
  },
  {
    type: 'analog' as const,
    title: 'Long title B',
    topic: 'b',
    rationale: 'r',
    sourceVideoIds: ['v1'],
    draftChapters: [{ title: 'c', subIdeas: [] }, { title: 'c2', subIdeas: [] }, { title: 'c3', subIdeas: [] }],
    riddle: 'q',
    sources: [source],
  },
  {
    type: 'analog' as const,
    title: 'Long title C',
    topic: 'c',
    rationale: 'r',
    sourceVideoIds: ['v1'],
    draftChapters: [{ title: 'c', subIdeas: [] }, { title: 'c2', subIdeas: [] }, { title: 'c3', subIdeas: [] }],
    riddle: 'q',
    sources: [source],
  },
];

describe('inferAdviceTopicIndex', () => {
  it('matches on short advice topic label', () => {
    expect(inferAdviceTopicIndex(topics, { title: 'Long title B', topic: 'b' })).toBe(1);
  });
});

describe('parseAdviceRunResults', () => {
  it('infers legacy run.projectId from project fields, not topic index 0', () => {
    const out = parseAdviceRunResults(
      { projectId: 'p1', results: { topics, warnings: [], topicProjects: {} } },
      { title: 'Long title B', topic: 'b' },
    );
    expect(out.topicProjects).toEqual({ '1': 'p1' });
  });

  it('does not assign run.projectId when the project does not match any topic', () => {
    const out = parseAdviceRunResults(
      { projectId: 'p1', results: { topics, warnings: [], topicProjects: {} } },
      { title: 'Unknown', topic: 'x' },
    );
    expect(out.topicProjects).toEqual({});
  });

  it('does not assign run.projectId to topic 0 when topic 1 already has a project', () => {
    const out = parseAdviceRunResults({
      projectId: 'p1',
      results: { topics, warnings: [], topicProjects: { '1': 'p1' } },
    });
    expect(out.topicProjects).toEqual({ '1': 'p1' });
    expect(out.topicProjects['0']).toBeUndefined();
  });
});
