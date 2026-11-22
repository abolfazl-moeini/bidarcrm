import { describe, it, expect } from 'vitest';
import { formatToman, toPersianDigits, parseCurrencyInput } from '../lib/currency';

describe('Currency & Persian Digits Formatter', () => {
  it('formats amount in Toman with Persian thousand separators', () => {
    expect(formatToman(1000000)).toBe('۱,۰۰۰,۰۰۰ تومان');
    expect(formatToman(25500000)).toBe('۲۵,۵۰۰,۰۰۰ تومان');
  });

  it('converts English digits to Persian digits', () => {
    expect(toPersianDigits('1234567890')).toBe('۱۲۳۴۵۶۷۸۹۰');
  });

  it('parses user input containing Persian digits and commas into number', () => {
    expect(parseCurrencyInput('۱۲,۵۰۰,۰۰۰')).toBe(12500000);
    expect(parseCurrencyInput('5,000,000')).toBe(5000000);
  });
});
