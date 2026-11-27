/**
 * BidarCRM - AccountCreateModal Component
 *
 * Modal dialog for creating companies and organizations:
 * - Organization name, industry, phone, email, website
 * - Customer groups multi-tag selection (GAP-05)
 * - Iranian legal entity fields: nationalId (شناسه ملی), economicCode (کد اقتصادی),
 *   postalCode (کد پستی), shebaNumber (شماره شبا) with validation
 * - Clean Didar styling with light/dark mode support
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Phone,
  Mail,
  Globe,
  Tag,
  FileText,
  CreditCard,
  MapPin,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Account } from '../../../types/espocrm';
import {
  validateCompanyNationalId,
  validatePostalCode,
  validateSheba,
} from '../../../lib/iran-format';

export interface AccountCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdAccount: Account) => void | Promise<void>;
}

const CUSTOMER_GROUP_OPTIONS = [
  { value: 'VIP', label: 'ویژه (VIP)' },
  { value: 'Reseller', label: 'نماینده / همکار' },
  { value: 'Loyal', label: 'وفادار' },
  { value: 'Exhibition', label: 'نمایشگاهی' },
  { value: 'FirstPurchase', label: 'خرید اول' },
];

export const AccountCreateModal: React.FC<AccountCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [customerGroups, setCustomerGroups] = useState<string[]>([]);

  // Iranian legal & financial fields
  const [nationalId, setNationalId] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [shebaNumber, setShebaNumber] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setIndustry('');
    setPhoneNumber('');
    setEmailAddress('');
    setWebsite('');
    setCustomerGroups([]);
    setNationalId('');
    setEconomicCode('');
    setPostalCode('');
    setShebaNumber('');
    setError(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleGroup = (grp: string) => {
    setCustomerGroups((prev) =>
      prev.includes(grp) ? prev.filter((g) => g !== grp) : [...prev, grp]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('نام شرکت یا سازمان الزامی است.');
      return;
    }

    // Client validations for Iranian fields
    if (nationalId.trim() && !validateCompanyNationalId(nationalId.trim())) {
      setError('شناسه ملی شرکت معتبر نیست (باید ۱۱ رقم با الگوریتم معتبر باشد).');
      return;
    }

    if (postalCode.trim() && !validatePostalCode(postalCode.trim())) {
      setError('کد پستی ۱۰ رقمی معتبر نیست.');
      return;
    }

    if (shebaNumber.trim() && !validateSheba(shebaNumber.trim())) {
      setError('شماره شبا نامعتبر است (الگوی IR به همراه ۲۴ رقم).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Account> & Record<string, unknown> = {
        name: trimmedName,
        industry: industry.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        emailAddress: emailAddress.trim() || undefined,
        website: website.trim() || undefined,
        customerGroups: customerGroups.length > 0 ? customerGroups : undefined,
        nationalId: nationalId.trim() || undefined,
        economicCode: economicCode.trim() || undefined,
        billingAddressPostalCode: postalCode.trim() || undefined,
        shebaNumber: shebaNumber.trim() || undefined,
      };

      const created = await apiClient.post<Account>('/Account', payload);
      resetForm();
      onClose();
      if (onSuccess) {
        await onSuccess(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت شرکت جدید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-create-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="account-create-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-100"
              >
                ثبت شرکت / سازمان جدید
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                مشخصات حقوقی، اطلاعات تماس و گروه‌بندی مشتری
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Company Name & Industry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نام شرکت / سازمان <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: شرکت داده‌پردازی آریا"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                صنعت / حوزه فعالیت
              </label>
              <input
                type="text"
                list="industry-options"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="مثال: فناوری اطلاعات، بازرگانی، پزشکی..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
              />
              <datalist id="industry-options">
                <option value="فناوری اطلاعات و ارتباطات">فناوری اطلاعات و ارتباطات (Technology)</option>
                <option value="نرم‌افزار">نرم‌افزار (Software)</option>
                <option value="تبلیغات و بازاریابی">تبلیغات و بازاریابی (Advertising)</option>
                <option value="تولید و صنعت">تولید و صنعت (Manufacturing)</option>
                <option value="پزشکی و سلامت">پزشکی و سلامت (Healthcare)</option>
                <option value="خدمات مالی و بانکی">خدمات مالی و بانکی (Finance)</option>
                <option value="بازرگانی و فروشگاهی">بازرگانی و فروشگاهی (Retail)</option>
                <option value="مشاوره مدیریت">مشاوره مدیریت (Consulting)</option>
                <option value="سایر">سایر (Other)</option>
              </datalist>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شماره تماس
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="02188888888"
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                آدرس ایمیل
              </label>
              <div className="relative">
                <input
                  type="email"
                  dir="ltr"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="info@company.ir"
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                وب‌سایت
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="company.ir"
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
                />
                <Globe className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Customer Groups Multi-Tags (GAP-05) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>گروه‌های مشتری (برچسب‌ها):</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOMER_GROUP_OPTIONS.map((grp) => {
                const isSelected = customerGroups.includes(grp.value);
                return (
                  <button
                    key={grp.value}
                    type="button"
                    onClick={() => toggleGroup(grp.value)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{grp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Iranian Legal & Financial Information */}
          <div className="p-3 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
              اطلاعات مالی و حقوقی ایران:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  شناسه ملی شرکت (۱۱ رقم)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    maxLength={11}
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="10101234567"
                    className="w-full pl-3 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono outline-none"
                  />
                  <FileText className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  کد اقتصادی
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={economicCode}
                  onChange={(e) => setEconomicCode(e.target.value)}
                  placeholder="کد اقتصادی ۱۴ رقمی"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  کد پستی ۱۰ رقمی
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    maxLength={10}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="1234567890"
                    className="w-full pl-3 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono outline-none"
                  />
                  <MapPin className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  شماره شبا بانکی
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    maxLength={26}
                    value={shebaNumber}
                    onChange={(e) => setShebaNumber(e.target.value)}
                    placeholder="IR120000000000000000000000"
                    className="w-full pl-3 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono outline-none"
                  />
                  <CreditCard className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>ذخیره شرکت</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountCreateModal;
