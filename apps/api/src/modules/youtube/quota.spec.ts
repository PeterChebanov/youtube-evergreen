import { nextQuotaReset, quotaDay } from './quota';

describe('YouTube quota day', () => {
  it('follows Pacific time, not UTC', () => {
    expect(quotaDay(new Date('2026-10-05T03:00:00Z'))).toBe('2026-10-04');
    expect(quotaDay(new Date('2026-10-05T08:00:00Z'))).toBe('2026-10-05');
  });

  it('resets at Pacific midnight in summer (UTC-7)', () => {
    expect(nextQuotaReset(new Date('2026-10-04T10:00:00Z')).toISOString()).toBe('2026-10-05T07:00:00.000Z');
  });

  it('resets at Pacific midnight in winter (UTC-8)', () => {
    expect(nextQuotaReset(new Date('2026-12-01T10:00:00Z')).toISOString()).toBe('2026-12-02T08:00:00.000Z');
  });

  it('handles the night daylight saving ends', () => {
    expect(nextQuotaReset(new Date('2026-10-31T20:00:00Z')).toISOString()).toBe('2026-11-01T07:00:00.000Z');
    expect(nextQuotaReset(new Date('2026-11-01T12:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });
});
