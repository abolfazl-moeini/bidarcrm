/**
 * BidarCRM - Iran Format & Validation Utilities (IR-09, IR-10, IR-11)
 * Clean, robust TypeScript implementations matching EspoCRM BidarIran module.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const ENGLISH_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Converts English and Arabic digits to Persian digits.
 */
export function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(ARABIC_DIGITS[i]!, PERSIAN_DIGITS[i]!);
    res = res.replaceAll(ENGLISH_DIGITS[i]!, PERSIAN_DIGITS[i]!);
  }
  return res;
}

/**
 * Converts Persian and Arabic digits to standard ASCII English digits.
 */
export function toEnglishDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(PERSIAN_DIGITS[i]!, ENGLISH_DIGITS[i]!);
    res = res.replaceAll(ARABIC_DIGITS[i]!, ENGLISH_DIGITS[i]!);
  }
  return res;
}

/**
 * Formats a numeric amount with thousands separators and Persian digits + currency unit.
 */
export function formatCurrency(amount: number | null | undefined, unit: string = 'تومان'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `۰ ${unit}`;
  }
  const formatted = new Intl.NumberFormat('en-US').format(Math.round(amount));
  return `${toPersianDigits(formatted)} ${unit}`;
}

export const formatIranCurrency = formatCurrency;

/**
 * Normalizes Persian/Arabic characters for search queries and indexing.
 * Unifies Yeh (ي, ى -> ی), Kaf (ك -> ک), removes Tatweel, converts digits to English,
 * strips ZWNJ/punctuation, and collapses spaces.
 */
export function normalizePersianSearch(text: string | null | undefined): string {
  if (!text) return '';
  let str = String(text);

  // 1. Unify Yeh
  str = str.replace(/[\u064A\u0649]/g, '\u06CC');
  // 2. Unify Kaf
  str = str.replace(/\u0643/g, '\u06A9');
  // 3. Normalize Heh with Yeh
  str = str.replace(/\u06C0/g, 'ه');
  // 4. Remove Tatweel (Kashida)
  str = str.replace(/\u0640/g, '');
  // 5. Remove Arabic Diacritics (Harakat)
  str = str.replace(/[\u064B-\u0652]/g, '');
  // 6. Replace ZWNJ and punctuation with spaces
  str = str.replace(/[\u200C\u200D]/g, ' ');
  str = str.replace(/[()[\]{}«»"':;,؟?!.\-_/\\|]/g, ' ');
  // 7. Convert Digits to English
  str = toEnglishDigits(str);
  // 8. Collapse duplicate spaces and trim
  str = str.replace(/\s+/g, ' ').trim();

  return str.toLowerCase();
}

/**
 * Normalizes and formats an Iranian mobile or phone number.
 * e.g. "09121234567" -> "۰۹۱۲ ۳۴۵ ۶۷۸۹"
 */
export function formatIranPhone(phone: string | null | undefined, persianDigits: boolean = true): string {
  if (!phone) return '';
  const ascii = toEnglishDigits(phone).replace(/[^\d+]/g, '');

  let local = '';
  const mobileMatch = ascii.match(/^(?:\+98|0098|98|0)?(9\d{9})$/);
  if (mobileMatch && mobileMatch[1]) {
    local = '0' + mobileMatch[1];
    const formatted = `${local.substring(0, 4)} ${local.substring(4, 7)} ${local.substring(7)}`;
    return persianDigits ? toPersianDigits(formatted) : formatted;
  }

  const landlineMatch = ascii.match(/^(?:\+98|0098|98|0)?([1-8]\d{9})$/);
  if (landlineMatch && landlineMatch[1]) {
    local = '0' + landlineMatch[1];
    const formatted = `${local.substring(0, 3)} ${local.substring(3, 7)} ${local.substring(7)}`;
    return persianDigits ? toPersianDigits(formatted) : formatted;
  }

  return persianDigits ? toPersianDigits(phone) : phone;
}

/**
 * Validates an Iranian National Code (کد ملی) according to official check-digit algorithm.
 */
export function validateNationalCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const clean = toEnglishDigits(code).replace(/[\s\-]/g, '');

  if (!/^\d{10}$/.test(clean)) {
    return false;
  }

  // Identical digits are invalid (e.g. 0000000000, 1111111111)
  const allSame = clean.split('').every((char) => char === clean[0]);
  if (allSame) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]!, 10) * (10 - i);
  }

  const remainder = sum % 11;
  const checkDigit = parseInt(clean[9]!, 10);

  return (remainder < 2 && checkDigit === remainder) || (remainder >= 2 && checkDigit === 11 - remainder);
}

export const isValidIranianNationalCode = validateNationalCode;

/**
 * Validates an Iranian Bank IBAN/Sheba (شماره شبا).
 * Must be 26 characters: 'IR' + 24 digits, with IBAN Mod-97 verification.
 */
export function validateSheba(sheba: string | null | undefined): boolean {
  if (!sheba) return false;
  const clean = toEnglishDigits(sheba).replace(/[\s\-]/g, '').toUpperCase();

  if (!/^IR\d{24}$/.test(clean)) {
    return false;
  }

  const checkDigits = clean.substring(2, 4);
  const bban = clean.substring(4);
  // 'IR' in letters is I=18, R=27
  const numeric = bban + '1827' + checkDigits;

  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + parseInt(numeric[i]!, 10)) % 97;
  }

  return remainder === 1;
}

/**
 * Validates a 10-digit Iranian postal code (کد پستی).
 */
export function validatePostalCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const clean = toEnglishDigits(code).replace(/[\s\-]/g, '');

  if (!/^[13-9]{5}[0-9]{5}$/.test(clean)) {
    return false;
  }

  // First 5 digits cannot be all identical
  const first5 = clean.substring(0, 5);
  const allSame = first5.split('').every((char) => char === first5[0]);
  return !allSame;
}

/**
 * Validates an 11-digit Iranian Legal Entity / Company National ID (شناسه ملی شرکت‌ها).
 */
export function validateCompanyNationalId(id: string | null | undefined): boolean {
  if (!id) return false;
  const clean = toEnglishDigits(id).replace(/[\s\-]/g, '');

  if (!/^\d{11}$/.test(clean)) {
    return false;
  }

  const allSame = clean.split('').every((char) => char === clean[0]);
  if (allSame) {
    return false;
  }

  const digits = clean.split('').map((c) => parseInt(c, 10));
  const t = digits[9]! + 2;
  const weights = [29, 27, 23, 19, 17, 29, 27, 23, 19, 17];

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += (digits[i]! + t) * weights[i]!;
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 10 ? 0 : remainder;

  return digits[10] === checkDigit;
}
