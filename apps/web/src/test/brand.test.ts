import { describe, it, expect } from 'vitest';
import brand, {
  brandName,
  brandNameFa,
  fullName,
  fullNameFa,
  taglineFa,
  copyrightFa,
  websiteUrl,
  supportUrl,
  colors,
} from '../lib/brand';

describe('Brand Configuration & Clean-Room Identity (WL-07)', () => {
  it('exports standardized brand identity constants', () => {
    expect(brandName).toBe('Bidar');
    expect(brandNameFa).toBe('بیدار');
    expect(fullName).toBe('BidarCRM');
    expect(fullNameFa).toContain('بیدار');
    expect(taglineFa).toContain('بیدار');
    expect(copyrightFa).toContain('بیدار');
    expect(websiteUrl).toBe('https://bidarcrm.ir');
    expect(supportUrl).toBe('https://bidarcrm.ir/support');
  });

  it('defines the Bidar clean-room color palette with teal primary', () => {
    expect(colors.primary).toBe('#0F766E');
    expect(colors.rail).toBe('#0F172A');
    expect(colors.topbar).toBe('#111827');
    expect(colors.canvas).toBe('#F4F6F8');
  });

  it('provides default export matching named exports', () => {
    expect(brand.brandName).toBe(brandName);
    expect(brand.brandNameFa).toBe(brandNameFa);
    expect(brand.colors).toEqual(colors);
  });
});
