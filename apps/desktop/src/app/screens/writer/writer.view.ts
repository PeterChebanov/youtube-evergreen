import type { WriterState } from '../../core/api.types';

type Chapter = WriterState['chapters'][number];

export const chapterLabel = (c: Chapter, writingOrder: number | null) =>
  c.chapterOrder === writingOrder ? 'writing' : c.status === 'approved' ? 'done' : c.status;

/** The chapter the author works on when nothing is selected: the first one not approved yet. */
export function focusChapter(state: WriterState): Chapter | null {
  return state.chapters.find((c) => c.status !== 'approved') ?? state.chapters.at(-1) ?? null;
}

export type NextStep =
  | { kind: 'write'; order: number; label: string }
  | { kind: 'approve-and-write'; order: number; next: number; label: string }
  | { kind: 'approve'; order: number; label: string }
  | { kind: 'none'; label: string };

/**
 * "Next chapter": approves the current draft (its summary feeds the next one)
 * and writes the following chapter.
 */
export function nextStep(state: WriterState, current: Chapter | null): NextStep {
  if (!current) return { kind: 'none', label: 'Next chapter' };
  if (current.status === 'todo') return { kind: 'write', order: current.chapterOrder, label: 'Write chapter' };
  const next = state.chapters.find((c) => c.chapterOrder > current.chapterOrder && c.status === 'todo');
  if (current.status === 'draft') {
    return next
      ? { kind: 'approve-and-write', order: current.chapterOrder, next: next.chapterOrder, label: 'Next chapter' }
      : { kind: 'approve', order: current.chapterOrder, label: 'Approve chapter' };
  }
  return next ? { kind: 'write', order: next.chapterOrder, label: 'Next chapter' } : { kind: 'none', label: 'Next chapter' };
}
