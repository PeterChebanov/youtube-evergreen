import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyManualPlanTiming, finalizePlan, planTotalDurationMin } from './plan.schema';

const chapter = (title: string, lengthMin: number) => ({
  title,
  description: 'd',
  lengthMin,
  subpoints: [],
  hooks: [],
  techniques: [],
  ending: '',
  bridge: '',
  buildsOn: '',
  doNotRepeat: [],
});

describe('applyManualPlanTiming', () => {
  it('keeps chapter lengths and shifts starts after a middle removal', () => {
    const draft = {
      narrativeFramework: 'fw',
      recurringCast: [],
      riddle: { question: 'q', plantMin: 2, answerMin: 8 },
      chapters: [chapter('A', 7), chapter('C', 8)],
    };
    const plan = applyManualPlanTiming(draft, 45);
    assert.deepEqual(
      plan.chapters.map((c) => c.lengthMin),
      [7, 8],
    );
    assert.deepEqual(
      plan.chapters.map((c) => c.startMin),
      [0, 7],
    );
    assert.equal(planTotalDurationMin(plan), 15);
    assert.equal(plan.targetDurationMin, 45);
  });

  it('finalizePlan still scales to target', () => {
    const draft = {
      narrativeFramework: 'fw',
      recurringCast: [],
      riddle: { question: 'q', plantMin: 1, answerMin: 9 },
      chapters: [chapter('A', 10), chapter('B', 10)],
    };
    const plan = finalizePlan(draft, 20);
    assert.equal(planTotalDurationMin(plan), 20);
  });
});
