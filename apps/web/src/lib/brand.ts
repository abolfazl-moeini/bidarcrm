/**
 * BidarCRM - Brand Configuration (WL-07)
 * Single source of truth for brand identity, URLs, typography, and theme colors.
 */

export interface BrandConfig {
  brandName: string;
  brandNameFa: string;
  fullName: string;
  fullNameFa: string;
  taglineFa: string;
  copyrightFa: string;
  websiteUrl: string;
  supportUrl: string;
  colors: {
    primary: string;
    primaryHover: string;
    rail: string;
    topbar: string;
    canvas: string;
    surface: string;
    border: string;
    borderStrong: string;
    success: string;
    warning: string;
    danger: string;
  };
}

export const brand: BrandConfig = {
  brandName: 'Bidar',
  brandNameFa: 'بیدار',
  fullName: 'BidarCRM',
  fullNameFa: 'سامانه مدیریت ارتباط با مشتری بیدار',
  taglineFa: 'سامانه هوشمند مدیریت فروش و کاریز ارتباط با مشتری بیدار',
  copyrightFa: 'تمامی حقوق متعلق به سامانه مدیریت ارتباط با مشتری بیدار است.',
  websiteUrl: 'https://bidarcrm.ir',
  supportUrl: 'https://bidarcrm.ir/support',
  colors: {
    primary: '#0F766E', // Bidar Teal Clean-Room Palette
    primaryHover: '#115E59',
    rail: '#0F172A',
    topbar: '#111827',
    canvas: '#F4F6F8',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
  },
};

export const brandName = brand.brandName;
export const brandNameFa = brand.brandNameFa;
export const fullName = brand.fullName;
export const fullNameFa = brand.fullNameFa;
export const taglineFa = brand.taglineFa;
export const copyrightFa = brand.copyrightFa;
export const websiteUrl = brand.websiteUrl;
export const supportUrl = brand.supportUrl;
export const colors = brand.colors;

export default brand;
