import { z } from 'zod';

export const periodFilterSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('last'), months: z.number().int().min(1).max(120) }),
  z.object({
    kind: z.literal('range'),
    fromYearsAgo: z.number().int().min(0).max(30),
    toYearsAgo: z.number().int().min(1).max(30),
  }),
  z.object({ kind: z.literal('olderThan'), years: z.number().int().min(1).max(30) }),
]);

export type PeriodFilter = z.infer<typeof periodFilterSchema>;

/** Plagiarism guard (REQUIREMENTS 2.6): by default only videos older than two years. */
export const DEFAULT_PERIOD: PeriodFilter = { kind: 'olderThan', years: 2 };

export const PERIOD_OPTIONS: ReadonlyArray<{ label: string; value: PeriodFilter }> = [
  { label: 'last month', value: { kind: 'last', months: 1 } },
  { label: 'last 2 months', value: { kind: 'last', months: 2 } },
  { label: 'last 3 months', value: { kind: 'last', months: 3 } },
  { label: 'last 6 months', value: { kind: 'last', months: 6 } },
  { label: 'last year', value: { kind: 'last', months: 12 } },
  { label: 'last 2 years', value: { kind: 'last', months: 24 } },
  { label: '3–5 years ago', value: { kind: 'range', fromYearsAgo: 3, toYearsAgo: 5 } },
  ...Array.from({ length: 10 }, (_, i) => ({
    label: `older than ${i + 1} year${i ? 's' : ''}`,
    value: { kind: 'olderThan', years: i + 1 } as PeriodFilter,
  })),
];

export type PublishedRange = { publishedAfter?: Date; publishedBefore?: Date };

function shift(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export function resolvePeriod(period: PeriodFilter, now: Date): PublishedRange {
  switch (period.kind) {
    case 'last':
      return { publishedAfter: shift(now, period.months) };
    case 'range': {
      const near = Math.min(period.fromYearsAgo, period.toYearsAgo);
      const far = Math.max(period.fromYearsAgo, period.toYearsAgo);
      return { publishedAfter: shift(now, far * 12), publishedBefore: shift(now, near * 12) };
    }
    case 'olderThan':
      return { publishedBefore: shift(now, period.years * 12) };
  }
}

export function describePeriod(period: PeriodFilter): string {
  return PERIOD_OPTIONS.find((o) => JSON.stringify(o.value) === JSON.stringify(period))?.label
    ?? JSON.stringify(period);
}
