import { describe, expect, it } from 'vitest';
import type { WriterState } from '../../core/api.types';
import { chapterLabel, focusChapter, nextStep } from './writer.view';

type Status = 'todo' | 'draft' | 'approved';
const state = (...statuses: Status[]): WriterState =>
  ({
    toneFromSubtitles: false,
    canFinalize: statuses.every((s) => s === 'approved'),
    chapters: statuses.map((status, i) => ({ chapterOrder: i + 1, title: `C${i + 1}`, version: 1, text: '', summary: null, status })),
  }) as WriterState;

describe('focusChapter', () => {
  it('opens the first chapter that is not approved yet', () => {
    expect(focusChapter(state('approved', 'draft', 'todo'))?.chapterOrder).toBe(2);
  });

  it('opens the last chapter when everything is approved', () => {
    expect(focusChapter(state('approved', 'approved'))?.chapterOrder).toBe(2);
  });
});

describe('nextStep', () => {
  it('writes a chapter that has no text yet', () => {
    const s = state('todo');
    expect(nextStep(s, s.chapters[0])).toMatchObject({ kind: 'write', order: 1, label: 'Write chapter' });
  });

  it('approves the draft and writes the following chapter', () => {
    const s = state('approved', 'draft', 'todo');
    expect(nextStep(s, s.chapters[1])).toEqual({ kind: 'approve-and-write', order: 2, next: 3, label: 'Next chapter' });
  });

  it('only approves the last draft', () => {
    const s = state('approved', 'draft');
    expect(nextStep(s, s.chapters[1])).toMatchObject({ kind: 'approve', order: 2 });
  });

  it('has nothing to do when every chapter is approved', () => {
    const s = state('approved', 'approved');
    expect(nextStep(s, s.chapters[1]).kind).toBe('none');
  });
});

it('labels the chapter being written', () => {
  const s = state('approved', 'todo');
  expect(s.chapters.map((c) => chapterLabel(c, 2))).toEqual(['done', 'writing']);
});
