import { describe, it, expect } from 'vitest';
import {
  numberToWords,
  tomanToWords,
  shortAmountLabel,
} from '../lib/number-to-words';

describe('number-to-words Persian Converter', () => {
  it('converts basic single and teen digits correctly', () => {
    expect(numberToWords(0)).toBe('صفر');
    expect(numberToWords(5)).toBe('پنج');
    expect(numberToWords(12)).toBe('دوازده');
    expect(numberToWords(19)).toBe('نوزده');
  });

  it('converts tens and hundreds correctly', () => {
    expect(numberToWords(25)).toBe('بیست و پنج');
    expect(numberToWords(100)).toBe('صد');
    expect(numberToWords(350)).toBe('سیصد و پنجاه');
    expect(numberToWords(999)).toBe('نهصد و نود و نه');
  });

  it('converts thousands, millions, and billions correctly', () => {
    expect(numberToWords(1000)).toBe('هزار');
    expect(numberToWords(2000)).toBe('دو هزار');
    expect(numberToWords(1500000)).toBe('یک میلیون و پانصد هزار');
    expect(numberToWords(45000000)).toBe('چهل و پنج میلیون');
    expect(numberToWords(1250000000)).toBe('یک میلیارد و دویست و پنجاه میلیون');
  });

  it('handles strings with commas and Persian numerals seamlessly', () => {
    expect(numberToWords('۴۵,۰۰۰,۰۰۰')).toBe('چهل و پنج میلیون');
    expect(numberToWords('۱۲۰،۵۰۰،۰۰۰')).toBe('صد و بیست میلیون و پانصد هزار');
    expect(tomanToWords('۴۵,۰۰۰,۰۰۰')).toBe('چهل و پنج میلیون تومان');
  });

  it('generates short amount labels for quick chips', () => {
    expect(shortAmountLabel(10_000_000)).toBe('۱۰ میلیون');
    expect(shortAmountLabel(50_000_000)).toBe('۵۰ میلیون');
    expect(shortAmountLabel(100_000_000)).toBe('۱۰۰ میلیون');
    expect(shortAmountLabel(1_000_000_000)).toBe('۱ میلیارد');
  });
});
