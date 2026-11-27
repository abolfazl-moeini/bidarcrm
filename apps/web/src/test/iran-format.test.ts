import { describe, it, expect } from 'vitest';
import {
  toPersianDigits,
  toEnglishDigits,
  formatCurrency,
  normalizePersianSearch,
  formatIranPhone,
  validateNationalCode,
  validateSheba,
  validatePostalCode,
  validateCompanyNationalId,
} from '../lib/iran-format';

describe('Iranian Localization & Formatting Utilities (IR-09, IR-10, IR-11)', () => {
  describe('toPersianDigits & toEnglishDigits', () => {
    it('converts ASCII digits to Persian digits', () => {
      expect(toPersianDigits('0123456789')).toBe('۰۱۲۳۴۵۶۷۸۹');
      expect(toPersianDigits(12345)).toBe('۱۲۳۴۵');
      expect(toPersianDigits('مبلغ: 50000 ریال')).toBe('مبلغ: ۵۰۰۰۰ ریال');
    });

    it('converts Persian/Arabic digits to English digits', () => {
      expect(toEnglishDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
      expect(toEnglishDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
      expect(toEnglishDigits('تلفن: ۰۹۱۲۳۴۵۶۷۸۹')).toBe('تلفن: 09123456789');
    });
  });

  describe('formatCurrency', () => {
    it('formats Toman amounts with Persian grouping and suffix', () => {
      expect(formatCurrency(1500000, 'تومان')).toBe('۱,۵۰۰,۰۰۰ تومان');
      expect(formatCurrency(0, 'تومان')).toBe('۰ تومان');
      expect(formatCurrency(null, 'تومان')).toBe('۰ تومان');
    });

    it('formats Rial amounts', () => {
      expect(formatCurrency(15000000, 'ریال')).toBe('۱۵,۰۰۰,۰۰۰ ریال');
    });
  });

  describe('normalizePersianSearch', () => {
    it('normalizes Arabic characters to standard Persian', () => {
      expect(normalizePersianSearch('شركت يزداني')).toBe('شرکت یزدانی');
      expect(normalizePersianSearch('علي كاشاني')).toBe('علی کاشانی');
    });

    it('strips ZWNJ and punctuation for fuzzy search', () => {
      expect(normalizePersianSearch('پیش‌فاکتور (رسمی)')).toBe('پیش فاکتور رسمی');
    });

    it('converts Persian digits to English for uniform search', () => {
      expect(normalizePersianSearch('شماره ۱۲۳')).toBe('شماره 123');
    });
  });

  describe('formatIranPhone', () => {
    it('formats 11-digit mobile numbers', () => {
      expect(formatIranPhone('09123456789')).toBe('۰۹۱۲ ۳۴۵ ۶۷۸۹');
      expect(formatIranPhone('+989123456789')).toBe('۰۹۱۲ ۳۴۵ ۶۷۸۹');
      expect(formatIranPhone('00989123456789')).toBe('۰۹۱۲ ۳۴۵ ۶۷۸۹');
      expect(formatIranPhone('09123456789', false)).toBe('0912 345 6789');
    });

    it('formats Tehran and province landlines', () => {
      expect(formatIranPhone('02188776655')).toBe('۰۲۱ ۸۸۷۷ ۶۶۵۵');
      expect(formatIranPhone('02188776655', false)).toBe('021 8877 6655');
    });
  });

  describe('validateNationalCode', () => {
    it('validates real and algorithmically correct national codes', () => {
      // 0010000003 is valid (0*10 + 0*9 + 1*8 = 8, 11 - 8 = 3)
      expect(validateNationalCode('0010000003')).toBe(true);
      expect(validateNationalCode('۰۰۱۰۰۰۰۰۰۳')).toBe(true);
    });

    it('rejects invalid national codes', () => {
      expect(validateNationalCode('1111111111')).toBe(false);
      expect(validateNationalCode('123456')).toBe(false);
      expect(validateNationalCode('1234567890')).toBe(false);
      expect(validateNationalCode('')).toBe(false);
    });
  });

  describe('validateSheba', () => {
    it('validates IBAN / Sheba format and check-digits', () => {
      expect(validateSheba('invalid')).toBe(false);
      expect(validateSheba('IR123')).toBe(false);
      expect(validateSheba('IR530540102680000197605001')).toBe(true);
      expect(validateSheba('ir530540102680000197605001')).toBe(true);
    });
  });

  describe('validatePostalCode & validateCompanyNationalId', () => {
    it('validates 10-digit postal codes', () => {
      expect(validatePostalCode('1939512345')).toBe(true);
      expect(validatePostalCode('۱۹۳۹۵۱۲۳۴۵')).toBe(true);
      expect(validatePostalCode('12345')).toBe(false);
      expect(validatePostalCode('0000000000')).toBe(false);
      expect(validatePostalCode('1234000000')).toBe(false); // 0 or 2 in first 5 digits
    });

    it('validates 11-digit legal entity national identifiers', () => {
      expect(validateCompanyNationalId('10100000006')).toBe(true);
      expect(validateCompanyNationalId('۱۰۱۰۰۰۰۰۰۰۶')).toBe(true);
      expect(validateCompanyNationalId('12345')).toBe(false);
    });
  });
});
