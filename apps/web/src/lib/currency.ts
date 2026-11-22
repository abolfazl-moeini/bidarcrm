/**
 * Persian number and currency formatting utilities.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toPersianDigits(input: string | number): string {
  const str = String(input);
  return str.replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)] ?? d);
}

export function toAsciiDigits(input: string): string {
  let res = input;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(PERSIAN_DIGITS[i]!, String(i));
    res = res.replaceAll(ARABIC_DIGITS[i]!, String(i));
  }
  return res;
}

export function formatToman(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US').format(Math.round(amount));
  return `${toPersianDigits(formatted)} تومان`;
}

export function parseCurrencyInput(input: string): number {
  const ascii = toAsciiDigits(input).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(ascii);
  return isNaN(parsed) ? 0 : parsed;
}
