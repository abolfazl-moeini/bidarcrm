/**
 * BidarCRM - Persian Number to Words Converter
 *
 * Inspired by FarsiUI & VibeFarsiUI.
 * Converts numbers into natural Persian words:
 *   12500000 -> «دوازده میلیون و پانصد هزار تومان»
 * Accepts numbers, strings with Persian or Latin digits, commas, and spaces.
 */

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = [
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

const AND = ' و ';

export function toLatinDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Words for 0 ... 999 */
function groupToWords(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;

  if (h) parts.push(HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]!);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]!);
    if (o) parts.push(ONES[o]!);
  }
  return parts.join(AND);
}

/** Parse mixed inputs into normalized digits */
function parseNumberInput(input: number | bigint | string): { negative: boolean; int: string } | null {
  let s = typeof input === 'number' ? (Number.isFinite(input) ? String(input) : '') : String(input);
  s = toLatinDigits(s).replace(/[٬،,_\s]/g, '').trim();
  if (/e/i.test(s)) s = BigInt(Math.trunc(Number(s))).toString();
  const m = /^([-+]?)(\d+)/.exec(s);
  if (!m || !m[2]) return null;
  return {
    negative: m[1] === '-',
    int: m[2].replace(/^0+(?=\d)/, ''),
  };
}

/**
 * Converts integer digits to Persian words.
 * Example: 1250000 -> «یک میلیون و دویست و پنجاه هزار»
 */
export function numberToWords(input: number | bigint | string): string {
  const p = parseNumberInput(input);
  if (!p) return '';
  if (/^0+$/.test(p.int)) return 'صفر';

  const groups: string[] = [];
  for (let end = p.int.length; end > 0; end -= 3) {
    groups.unshift(p.int.slice(Math.max(0, end - 3), end));
  }

  if (groups.length > SCALES.length) {
    return p.int;
  }

  const parts: string[] = [];
  groups.forEach((g, i) => {
    const n = Number(g);
    if (!n) return;
    const scale = SCALES[groups.length - 1 - i];
    if (scale === 'هزار' && n === 1) {
      parts.push('هزار');
    } else {
      parts.push(scale ? `${groupToWords(n)} ${scale}` : groupToWords(n));
    }
  });

  const words = parts.join(AND);
  return p.negative && words !== 'صفر' ? `منفی ${words}` : words;
}

/**
 * Returns formatted Persian amount with currency unit:
 * Example: 45000000 -> «چهل و پنج میلیون تومان»
 */
export function tomanToWords(input: number | bigint | string): string {
  const words = numberToWords(input);
  if (!words || words === 'صفر') return '';
  return `${words} تومان`;
}

/**
 * Quick short label for preset chips:
 * 10000000 -> «۱۰ میلیون»
 */
export function shortAmountLabel(n: number): string {
  if (n >= 1_000_000_000 && n % 100_000_000 === 0) {
    const b = n / 1_000_000_000;
    return `${b.toLocaleString('fa-IR')} میلیارد`;
  }
  if (n >= 1_000_000 && n % 100_000 === 0) {
    const m = n / 1_000_000;
    return `${m.toLocaleString('fa-IR')} میلیون`;
  }
  if (n >= 1_000 && n % 1_000 === 0) {
    const k = n / 1_000;
    return `${k.toLocaleString('fa-IR')} هزار`;
  }
  return `${n.toLocaleString('fa-IR')}`;
}
