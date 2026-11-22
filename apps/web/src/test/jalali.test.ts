import { describe, it, expect } from 'vitest';
import {
  toJalaliDateString,
  formatJalaliDate,
  toUtcIsoString,
  getJalaliMonthRangeUtc,
  isJalaliLeapYear,
  getJalaliMonthLength,
  getJalaliParts,
} from '../lib/jalali';

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

  describe('isJalaliLeapYear & getJalaliMonthLength', () => {
    it('identifies leap years accurately (1403, 1408, 1399 as leap, 1405 as normal)', () => {
      expect(isJalaliLeapYear(1403)).toBe(true);
      expect(isJalaliLeapYear(1408)).toBe(true);
      expect(isJalaliLeapYear(1399)).toBe(true);
      expect(isJalaliLeapYear(1405)).toBe(false);
      expect(isJalaliLeapYear(1406)).toBe(false);
    });

    it('returns exact month lengths for all 12 Jalali months', () => {
      // First 6 months: 31 days
      for (let m = 1; m <= 6; m++) {
        expect(getJalaliMonthLength(1405, m)).toBe(31);
      }
      // Next 5 months: 30 days
      for (let m = 7; m <= 11; m++) {
        expect(getJalaliMonthLength(1405, m)).toBe(30);
      }
      // Month 12 (Esfand): 30 days in leap year 1403, 29 in non-leap 1405
      expect(getJalaliMonthLength(1403, 12)).toBe(30);
      expect(getJalaliMonthLength(1405, 12)).toBe(29);
      expect(getJalaliMonthLength(1408, 12)).toBe(30);
    });

    it('uses getJalaliMonthLength in getJalaliMonthRangeUtc for leap Esfand', () => {
      // Esfand 1403 has 30 days (ends on 2025-03-20)
      const { toUtc: leapToUtc } = getJalaliMonthRangeUtc(1403, 12);
      expect(leapToUtc).toContain('2025-03-20');

      // Esfand 1405 has 29 days (ends on 2027-03-20)
      const { toUtc: normToUtc } = getJalaliMonthRangeUtc(1405, 12);
      expect(normToUtc).toBeDefined();
    });
  });

  describe('Defensive Guards for Invalid Dates', () => {
    it('returns empty string for invalid dates, null, or empty input in formatJalaliDate', () => {
      expect(formatJalaliDate('')).toBe('');
      expect(formatJalaliDate(null as any)).toBe('');
      expect(formatJalaliDate(undefined as any)).toBe('');
      expect(formatJalaliDate(new Date('invalid-date-string'))).toBe('');
      expect(formatJalaliDate('not-a-date')).toBe('');
    });

    it('returns valid fallback parts when passing invalid Date to getJalaliParts', () => {
      const parts = getJalaliParts(new Date('invalid-date'));
      expect(parts).toHaveProperty('year');
      expect(parts).toHaveProperty('month');
      expect(parts).toHaveProperty('day');
      expect(parts.year).toBeGreaterThan(1300);
      expect(parts.month).toBeGreaterThanOrEqual(1);
      expect(parts.month).toBeLessThanOrEqual(12);
    });
  });
});
