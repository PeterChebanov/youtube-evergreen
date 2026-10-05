import { z } from 'zod';

/** Calendar day in UTC (YYYY-MM-DD). */
export const isoDateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const researchPeriodFieldsObjectSchema = z.object({
  publishedAfter: isoDateStringSchema.optional(),
  publishedBefore: isoDateStringSchema.optional(),
});

export const researchPeriodFieldsSchema = researchPeriodFieldsObjectSchema.refine(
  (p) => {
    if (!p.publishedAfter || !p.publishedBefore) return true;
    return p.publishedAfter <= p.publishedBefore;
  },
  { message: 'publishedAfter must be on or before publishedBefore' },
);

/** For merging into larger request objects (use `.and(researchPeriodOrderRefine)` after merge). */
export const researchPeriodFieldsObject = researchPeriodFieldsObjectSchema;
export const researchPeriodOrderRefine = researchPeriodFieldsSchema;

export type ResearchPeriodInput = z.infer<typeof researchPeriodFieldsSchema>;

export type ResearchPeriod = {
  publishedAfter: Date | null;
  publishedBefore: Date | null;
};

export function hasResearchPeriod(period: ResearchPeriod): boolean {
  return !!(period.publishedAfter || period.publishedBefore);
}

export function parseResearchPeriod(input: ResearchPeriodInput | undefined | null): ResearchPeriod {
  if (!input) return { publishedAfter: null, publishedBefore: null };
  return {
    publishedAfter: input.publishedAfter ? startOfUtcDay(input.publishedAfter) : null,
    publishedBefore: input.publishedBefore ? endOfUtcDay(input.publishedBefore) : null,
  };
}

export function videoPublishedInPeriod(publishedAt: Date, period: ResearchPeriod): boolean {
  if (period.publishedAfter && publishedAt < period.publishedAfter) return false;
  if (period.publishedBefore && publishedAt > period.publishedBefore) return false;
  return true;
}

function startOfUtcDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function endOfUtcDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

/** Today in UTC as YYYY-MM-DD (default “to” date in UI). */
export function todayIsoDateUtc(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}
