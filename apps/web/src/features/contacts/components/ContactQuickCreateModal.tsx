/**
 * BidarCRM - ContactQuickCreateModal Component
 *
 * Fast modal dialog for creating contacts/leads with client-side validation,
 * automatic form reset on open/close/success, Didar-inspired clean styling,
 * and light/dark mode adaptation.
 */

import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Building2, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Contact } from '../../../types/espocrm';
import { validateNationalCode } from '../../../lib/iran-format';

export interface ContactQuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdContact: Contact) => void | Promise<void>;
}

export const ContactQuickCreateModal: React.FC<ContactQuickCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [accountName, setAccountName] = useState('');
  const [nationalCode, setNationalCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPhoneNumber('');
    setEmailAddress('');
    setAccountName('');
    setNationalCode('');
    setError(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedLastName = lastName.trim();
    const trimmedPhone = phoneNumber.trim();
    const trimmedNatCode = nationalCode.trim();

    if (!trimmedLastName || !trimmedPhone) {
      setError('نام خانوادگی یا شماره تماس الزامی است');
      return;
    }

    if (trimmedNatCode && !validateNationalCode(trimmedNatCode)) {
      setError('کد ملی ۱۰ رقمی معتبر نیست.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Contact> & { nationalCode?: string; accountName?: string } = {
        firstName: firstName.trim() || undefined,
        lastName: trimmedLastName,
        phoneNumber: trimmedPhone,
        emailAddress: emailAddress.trim() || undefined,
        accountName: accountName.trim() || undefined,
        nationalCode: trimmedNatCode || undefined,
      };

      const created = await apiClient.post<Contact>('/Contact', payload);
      resetForm();
      onClose();
      if (onSuccess) {
        await onSuccess(created);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت مخاطب جدید.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-create-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h3 id="contact-create-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ثبت سریع مخاطب جدید
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">نام</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="نام کوچک"
                data-testid="contact-first-name"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نام خانوادگی <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="نام خانوادگی"
                data-testid="contact-last-name"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              شماره همراه / تلفن <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                dir="ltr"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="شماره موبایل (مثال: 09121234567)"
                data-testid="contact-phone"
                className="w-full pr-3 pl-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition font-mono"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">آدرس ایمیل</label>
            <div className="relative">
              <input
                type="email"
                dir="ltr"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="ایمیل (مثال: info@example.ir)"
                data-testid="contact-email"
                className="w-full pr-3 pl-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition font-mono"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">نام شرکت / سازمان</label>
            <div className="relative">
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="نام شرکت یا سازمان (اختیاری)"
                data-testid="contact-account"
                className="w-full pr-3 pl-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition"
              />
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">کد ملی</label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                value={nationalCode}
                onChange={(e) => setNationalCode(e.target.value)}
                placeholder="کد ملی ۱۰ رقمی (اختیاری)"
                data-testid="contact-national-code"
                maxLength={10}
                className="w-full pr-3 pl-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition font-mono"
              />
              <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
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
              <span>ذخیره مخاطب</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactQuickCreateModal;
