import { describe, it, expect } from 'vitest';
import { toJalaliDateString, toUtcIsoString, getJalaliMonthRangeUtc } from '../lib/jalali';

describe('Jalali Date Utilities (Tehran Timezone)', () => {
  it('converts UTC ISO string to Persian Jalali date string accurately', () => {
    // 2026-11-22T08:30:00Z is 1405/09/01 in Iran
    const utcDate = '2026-11-22T08:30:00Z';
    const jalali = toJalaliDateString(utcDate);
    expect(jalali).toBe('۱۴۰۵/۰۹/۰۱');
  });

  it('correctly handles leap year (e.g. 1403/12/30)', () => {
    // 2025-03-20T00:00:00Z is 1403/12/30
    const leapDate = '2025-03-20T00:00:00Z';
    const jalali = toJalaliDateString(leapDate);
    expect(jalali).toBe('۱۴۰۳/۱۲/۳۰');
  });

  it('converts Jalali date input to UTC ISO string', () => {
    const iso = toUtcIsoString('1405/01/15');
    expect(iso).toContain('2026-04-04');
  });

  it('calculates the UTC boundary range for a given Jalali month', () => {
    // Month 9 (Azar) of 1405
    const { fromUtc, toUtc } = getJalaliMonthRangeUtc(1405, 9);
    expect(fromUtc).toBeDefined();
    expect(toUtc).toBeDefined();
    expect(new Date(fromUtc).getTime()).toBeLessThan(new Date(toUtc).getTime());
  });
});
