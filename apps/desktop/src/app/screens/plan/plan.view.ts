import { planTotalDurationMin, type PlanDraft } from '@youtube-ai-tool/shared';
import type { PlanChapter, PlanContent } from '../../core/api.types';
import { minutesClock } from '../../core/format';

export type TimelineMarker = { label: string; cls: 'from-left' | 'from-right'; left: string | null; right: string | null };

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Riddle markers are anchored to the nearer edge and grow inward, so a label
 * never leaves the timeline (DESIGN_SPEC 5.5).
 */
export function riddleMarkers(plan: PlanContent): TimelineMarker[] {
  const total = planTotalDurationMin(plan) || 1;
  const pct = (min: number) => Math.min(100, Math.max(0, (min / total) * 100));
  const marker = (label: string, at: number): TimelineMarker =>
    at <= 50
      ? { label, cls: 'from-left', left: `${round1(at)}%`, right: null }
      : { label, cls: 'from-right', left: null, right: `${round1(100 - at)}%` };
  return [
    marker(`riddle planted ${minutesClock(plan.riddle.plantMin)}`, pct(plan.riddle.plantMin)),
    marker(`riddle answered ${minutesClock(plan.riddle.answerMin)}`, pct(plan.riddle.answerMin)),
  ];
}

export type HookChip = { text: string; riddle: boolean };

const contains = (c: PlanChapter, min: number, last: boolean) => min >= c.startMin && (min < c.startMin + c.lengthMin || (last && min <= c.startMin + c.lengthMin));

/** Hooks of one chapter, with the riddle chips in the chapters that plant and answer it. */
export function chapterChips(plan: PlanContent, chapter: PlanChapter): HookChip[] {
  const last = chapter.order === plan.chapters.at(-1)?.order;
  const chips: HookChip[] = [];
  if (contains(chapter, plan.riddle.plantMin, last)) chips.push({ text: 'Riddle planted', riddle: true });
  if (contains(chapter, plan.riddle.answerMin, last)) chips.push({ text: 'Riddle answered', riddle: true });
  return [...chips, ...chapter.hooks.map((text) => ({ text, riddle: false }))];
}

export function planSubtitle(plan: PlanContent): string {
  return `Total ${minutesClock(planTotalDurationMin(plan))} · target ${minutesClock(plan.targetDurationMin)} · riddle at ${minutesClock(plan.riddle.plantMin)} / ${minutesClock(plan.riddle.answerMin)}.`;
}

/** Strip timing metadata before manual save; server rescales lengths to target duration. */
export function planToDraft(content: PlanContent): PlanDraft {
  return {
    riddle: { ...content.riddle },
    narrativeFramework: content.narrativeFramework,
    recurringCast: content.recurringCast ?? [],
    chapters: content.chapters.map((c) => ({
      title: c.title,
      description: c.description,
      lengthMin: c.lengthMin,
      subpoints: c.subpoints ?? [],
      hooks: c.hooks ?? [],
      techniques: c.techniques ?? [],
      ending: c.ending ?? '',
      bridge: c.bridge ?? '',
      buildsOn: c.buildsOn ?? '',
      doNotRepeat: c.doNotRepeat ?? [],
    })),
    dbDataUsed: content.dbDataUsed ?? [],
  };
}
