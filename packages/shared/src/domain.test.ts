import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PERIOD, resolvePeriod } from './advice/period';
import { formatCompact, formatInt } from './format';
import { canTransition, hasReached } from './projects/project-status';
import { adviceDraftSchema } from './schemas/advice.schema';
import { finalizePlan, planDraftSchema } from './schemas/plan.schema';

const NOW = new Date('2026-10-04T00:00:00Z');

describe('resolvePeriod', () => {
  it('defaults to videos older than two years (plagiarism guard)', () => {
    assert.deepEqual(resolvePeriod(DEFAULT_PERIOD, NOW), {
      publishedBefore: new Date('2024-10-04T00:00:00Z'),
    });
  });

  it('turns "last N months" into a lower bound', () => {
    assert.deepEqual(resolvePeriod({ kind: 'last', months: 3 }, NOW), {
      publishedAfter: new Date('2026-07-04T00:00:00Z'),
    });
  });

  it('turns "3–5 years ago" into a closed window regardless of argument order', () => {
    const expected = {
      publishedAfter: new Date('2021-10-04T00:00:00Z'),
      publishedBefore: new Date('2023-10-04T00:00:00Z'),
    };
    assert.deepEqual(resolvePeriod({ kind: 'range', fromYearsAgo: 3, toYearsAgo: 5 }, NOW), expected);
    assert.deepEqual(resolvePeriod({ kind: 'range', fromYearsAgo: 5, toYearsAgo: 3 }, NOW), expected);
  });
});

describe('project pipeline', () => {
  it('only moves forward one step at a time', () => {
    assert.equal(canTransition('draft', 'planning'), true);
    assert.equal(canTransition('planning', 'plan_approved'), true);
    assert.equal(canTransition('planning', 'researching'), false);
    assert.equal(canTransition('writing', 'planning'), false);
    assert.equal(canTransition('done', 'draft'), false);
  });

  it('knows whether a project has reached a step', () => {
    assert.equal(hasReached('researching', 'plan_approved'), true);
    assert.equal(hasReached('planning', 'plan_approved'), false);
  });
});

describe('finalizePlan', () => {
  const draft = planDraftSchema.parse({
    narrativeFramework: 'One framework for the whole video.',
    riddle: { question: 'Where did the people go?', plantMin: 1, answerMin: 45 },
    chapters: [
      { title: 'Cold open', description: 'd', lengthMin: 5 },
      { title: 'Middle', description: 'd', lengthMin: 20 },
      { title: 'Answer', description: 'd', lengthMin: 25 },
    ],
  });

  it('scales chapter lengths to the target duration and computes start times', () => {
    const plan = finalizePlan(draft, 60);
    assert.deepEqual(
      plan.chapters.map((c) => [c.order, c.startMin, c.lengthMin]),
      [
        [1, 0, 6],
        [2, 6, 24],
        [3, 30, 30],
      ],
    );
    assert.deepEqual(plan.riddle, { question: 'Where did the people go?', plantMin: 1.2, answerMin: 54 });
  });

  it('rejects a riddle answered before it is planted', () => {
    const bad = planDraftSchema.safeParse({ ...draft, riddle: { question: 'q', plantMin: 30, answerMin: 10 } });
    assert.equal(bad.success, false);
  });
});

describe('adviceDraftSchema', () => {
  const topic = (type: 'rework' | 'analog') => ({
    type,
    title: 't',
    topic: 't',
    rationale: 'r',
    sourceVideoIds: ['v1'],
    draftChapters: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
    riddle: 'q',
  });

  it('accepts one rework and two analogues', () => {
    assert.equal(adviceDraftSchema.safeParse({ topics: [topic('rework'), topic('analog'), topic('analog')] }).success, true);
  });

  it('rejects any other mix', () => {
    assert.equal(adviceDraftSchema.safeParse({ topics: [topic('rework'), topic('rework'), topic('analog')] }).success, false);
    assert.equal(adviceDraftSchema.safeParse({ topics: [topic('analog'), topic('analog'), topic('analog')] }).success, false);
    assert.equal(adviceDraftSchema.safeParse({ topics: [topic('rework'), topic('analog')] }).success, false);
  });
});

describe('number formatting', () => {
  it('uses comma thousands and compact suffixes', () => {
    assert.equal(formatInt(1912400), '1,912,400');
    assert.equal(formatCompact(1_200_000), '1.2M');
    assert.equal(formatCompact(2_000_000), '2M');
    assert.equal(formatCompact(950), '950');
  });
});
