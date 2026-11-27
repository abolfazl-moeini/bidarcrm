import { toAsciiDigits } from './currency';

/**
 * Robust Jalali (Shamsi) Date Converter & Formatter (IR-09, IR-10, IR-11)
 */

export function toJalaliDateString(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tehran',
  });
  return formatter.format(d);
}

export const formatJalaliDate = toJalaliDateString;

/**
 * Formats a date to Jalali Date and Time (e.g. ۱۴۰۴/۰۸/۲۲ ۱۵:۳۰).
 */
export function formatJalaliDateTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tehran',
  });
  return formatter.format(d);
}

/**
 * Formats relative Persian time (e.g. "امروز", "دیروز", "فردا", "۳ روز پیش", "۲ ساعت پیش", "چند لحظه پیش").
 */
export function formatRelativeJalali(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (Math.abs(diffSec) < 45) {
    return 'چند لحظه پیش';
  }
  if (diffSec > 0) {
    if (diffMin < 60) return `${diffMin} دقیقه پیش`;
    if (diffHour < 24) return `${diffHour} ساعت پیش`;
    if (diffDay === 1) return 'دیروز';
    if (diffDay < 30) return `${diffDay} روز پیش`;
  } else {
    const futureDay = Math.abs(diffDay);
    if (futureDay === 1) return 'فردا';
    if (futureDay < 30) return `${futureDay} روز دیگر`;
  }

  return formatJalaliDate(d);
}

/**
 * Determines whether a given Jalali (Shamsi) year is a leap year (366 days, Esfand has 30 days).
 * Uses the canonical Birashk 33-year cycle algorithm matching Morilog/Jalali CalendarUtils.
 */
export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let jp = breaks[0]!;
  let jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (jump - n < 6) {
    n = n - jump + Math.floor((jump + 4) / 33) * 33;
  }
  let leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return leap === 0;
}

/**
 * Returns the exact number of days in a given Jalali month (1-6: 31, 7-11: 30, 12: 29 or 30).
 */
export function getJalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]!; gm++) {
    gd -= sal_a[gm]!;
  }
  return [gy, gm, gd];
}

export function toUtcIsoString(jalaliStr: string): string {
  const ascii = toAsciiDigits(jalaliStr);
  const parts = ascii.split('/').map((s) => parseInt(s, 10));
  const jy = parts[0] ?? 1400;
  const jm = parts[1] ?? 1;
  const jd = parts[2] ?? 1;

  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${gy}-${pad(gm)}-${pad(gd)}T08:30:00.000Z`;
}

export const PERSIAN_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const PERSIAN_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

export function getJalaliParts(date: Date = new Date()): { year: number; month: number; day: number } {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }).formatToParts(d);

  let year = 1405;
  let month = 9;
  let day = 1;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'day') day = parseInt(part.value, 10);
  }

  return { year, month, day };
}

export function getJalaliMonthRangeUtc(
  year: number,
  month: number
): { fromUtc: string; toUtc: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const [sGy, sGm, sGd] = jalaliToGregorian(year, month, 1);
  const lastDay = getJalaliMonthLength(year, month);
  const [eGy, eGm, eGd] = jalaliToGregorian(year, month, lastDay);

  return {
    fromUtc: `${sGy}-${pad(sGm)}-${pad(sGd)}T00:00:00.000Z`,
    toUtc: `${eGy}-${pad(eGm)}-${pad(eGd)}T23:59:59.999Z`,
  };
}

export function getJalaliMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const range = getJalaliMonthRangeUtc(year, month);
  return {
    start: new Date(range.fromUtc),
    end: new Date(range.toUtc),
  };
}

export { formatIranCurrency, toPersianDigits } from './iran-format';

/**
 * Canonical Iranian Official Holidays (Solar Calendar fixed dates) & Fridays
 */
export const IRAN_FIXED_HOLIDAYS: Record<string, string> = {
  '1/1': 'جشن نوروز',
  '1/2': 'عید نوروز',
  '1/3': 'عید نوروز',
  '1/4': 'عید نوروز',
  '1/12': 'روز جمهوری اسلامی',
  '1/13': 'روز طبیعت (سیزده‌بدر)',
  '3/14': 'رحلت امام خمینی',
  '3/15': 'قیام ۱۵ خرداد',
  '11/22': 'پیروزی انقلاب اسلامی',
  '12/29': 'ملی شدن صنعت نفت',
  '12/30': 'روز پایانی سال (کبیسه)',
};

/**
 * Checks if a given Jalali date is an Iranian official holiday or Friday.
 */
export function isIranHoliday(
  year: number,
  month: number,
  day: number
): { isHoliday: boolean; title?: string } {
  // Check solar holiday by month/day key
  const key = `${month}/${day}`;
  if (IRAN_FIXED_HOLIDAYS[key]) {
    return { isHoliday: true, title: IRAN_FIXED_HOLIDAYS[key] };
  }

  // Check if it's Friday (جمعه)
  const [gy, gm, gd] = jalaliToGregorian(year, month, day);
  const gDate = new Date(Date.UTC(gy, gm - 1, gd));
  if (gDate.getUTCDay() === 5) {
    // UTC Friday
    return { isHoliday: true, title: 'جمعه (تعطیل هفتگی)' };
  }

  return { isHoliday: false };
}

/**
 * Parses natural Persian relative expressions into Date objects.
 * Supports: "امروز", "فردا", "پس‌فردا", "هفته آینده", "ساعت ۱۰", "ساعت ۱۴:۳۰"
 */
export function parseNaturalPersianDate(input: string): Date | null {
  if (!input || typeof input !== 'string') return null;
  const raw = toAsciiDigits(input).trim().toLowerCase();

  const now = new Date();
  let target = new Date(now);

  if (raw.includes('امروز')) {
    // keep today
  } else if (raw.includes('فردا')) {
    target.setDate(target.getDate() + 1);
  } else if (raw.includes('پس‌فردا') || raw.includes('پس فردا')) {
    target.setDate(target.getDate() + 2);
  } else if (raw.includes('هفته بعد') || raw.includes('هفته آینده')) {
    target.setDate(target.getDate() + 7);
  } else {
    // Fallback: try parsing standard ISO/date
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  }

  // Parse hour if mentioned, e.g. "ساعت 10" or "ساعت 14:30"
  const timeMatch = raw.match(/ساعت\s*(\d{1,2})(?::(\d{1,2}))?/);
  if (timeMatch && timeMatch[1]) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    target.setHours(hours, minutes, 0, 0);
  } else {
    target.setHours(10, 0, 0, 0); // Default to 10:00 AM
  }

  return target;
}

