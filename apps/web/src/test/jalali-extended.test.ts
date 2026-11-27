import { describe, it, expect } from 'vitest';
import {
  formatJalaliDateTime,
  formatRelativeJalali,
  getJalaliMonthBounds,
  toJalaliDateString,
  formatJalaliDate,
  PERSIAN_MONTH_NAMES,
  isJalaliLeapYear,
  getJalaliMonthLength,
} from '../lib/jalali';

describe('Extended Jalali Localization Utilities (IR-09)', () => {
  it('formats Jalali date and time correctly', () => {
    // 2026-11-23 10:30 UTC -> 1405/09/02 or similar
    const formatted = formatJalaliDateTime('2026-11-23T10:30:00Z');
    expect(formatted).toBeTruthy();
    expect(formatted).toMatch(/۱۴۰۵/);
  });

  it('formats relative Jalali time for past and future', () => {
    const now = new Date();
    const pastMinutes = new Date(now.getTime() - 15 * 60 * 1000);
    const pastDays = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const futureHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    expect(formatRelativeJalali(pastMinutes.toISOString())).toMatch(/دقیقه پیش/);
    expect(formatRelativeJalali(pastDays.toISOString())).toMatch(/روز پیش/);
    expect(formatRelativeJalali(futureHours.toISOString())).toBeTruthy();
  });

  it('returns valid Jalali month boundaries', () => {
    const bounds = getJalaliMonthBounds(1405, 9); // Azar 1405
    expect(bounds.start).toBeInstanceOf(Date);
    expect(bounds.end).toBeInstanceOf(Date);
    expect(bounds.end.getTime()).toBeGreaterThan(bounds.start.getTime());
  });

  it('preserves existing core Jalali exports', () => {
    expect(toJalaliDateString('2026-11-23')).toMatch(/۱۴۰۵/);
    expect(formatJalaliDate('2026-11-23')).toMatch(/۱۴۰۵/);
    expect(PERSIAN_MONTH_NAMES[0]).toBe('فروردین');
    expect(PERSIAN_MONTH_NAMES[8]).toBe('آذر');
    expect(PERSIAN_MONTH_NAMES[11]).toBe('اسفند');
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(getJalaliMonthLength(1403, 12)).toBe(30);
    expect(getJalaliMonthLength(1404, 12)).toBe(29);
  });
});
