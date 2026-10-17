import { describe, expect, it } from 'vitest';
import type { PlanContent } from '../../core/api.types';
import { chapterChips, planSubtitle, riddleMarkers } from './plan.view';

const chapter = (order: number, startMin: number, lengthMin: number, hooks: string[] = []) =>
  ({ order, title: `Chapter ${order}`, description: '', startMin, lengthMin, subpoints: [], hooks, techniques: [], ending: '', bridge: '' });

const plan = {
  targetDurationMin: 50,
  riddle: { question: 'Where did the people go?', plantMin: 1.5, answerMin: 50 },
  chapters: [chapter(1, 0, 10, ['Open loop']), chapter(2, 10, 20), chapter(3, 30, 20)],
  dbDataUsed: [],
} as unknown as PlanContent;

describe('riddleMarkers', () => {
  it('anchors a marker in the first half to the left edge and one in the second half to the right', () => {
    expect(riddleMarkers(plan)).toEqual([
      { label: 'riddle planted 1:30', cls: 'from-left', left: '3%', right: null },
      { label: 'riddle answered 50:00', cls: 'from-right', left: null, right: '0%' },
    ]);
  });
});

describe('chapterChips', () => {
  it('puts the riddle chips before the hooks in the chapters that plant and answer it', () => {
    const [first, second, last] = plan.chapters;
    expect(chapterChips(plan, first)).toEqual([
      { text: 'Riddle planted', riddle: true },
      { text: 'Open loop', riddle: false },
    ]);
    expect(chapterChips(plan, second)).toEqual([]);
    expect(chapterChips(plan, last)).toEqual([{ text: 'Riddle answered', riddle: true }]);
  });
});

it('describes total length, target and riddle timing', () => {
  expect(planSubtitle(plan)).toBe('Total 50:00 · target 50:00 · riddle at 1:30 / 50:00.');
});
