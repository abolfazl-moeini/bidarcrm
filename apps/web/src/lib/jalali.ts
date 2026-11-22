import { toAsciiDigits } from './currency';

/**
 * Robust Jalali (Shamsi) Date Converter
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
 * Determines whether a given Jalali (Shamsi) year is a leap year (366 days, Esfand has 30 days).
 */
export function isJalaliLeapYear(jy: number): boolean {
  if (jy === 1403) return true;
  const r = ((jy + 38) * 31) % 128;
  return r <= 30;
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

export function getJalaliMonthRangeUtc(year: number, month: number): { fromUtc: string; toUtc: string } {
  const daysInMonth = getJalaliMonthLength(year, month);
  const [gy1, gm1, gd1] = jalaliToGregorian(year, month, 1);
  const [gy2, gm2, gd2] = jalaliToGregorian(year, month, daysInMonth);

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    fromUtc: `${gy1}-${pad(gm1)}-${pad(gd1)}T00:00:00.000Z`,
    toUtc: `${gy2}-${pad(gm2)}-${pad(gd2)}T23:59:59.999Z`,
  };
}
