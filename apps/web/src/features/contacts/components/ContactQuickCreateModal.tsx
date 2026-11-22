/**
 * BidarCRM - ContactQuickCreateModal Component
 *
 * Fast modal dialog for creating contacts/leads with client-side validation
 * and seamless feedback.
 */

import React, { useState } from 'react';
import { X, User, Phone, Mail, Building2, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Contact } from '../../../types/espocrm';

export interface ContactQuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdContact: Contact) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: at least lastName or phoneNumber
    if (!lastName.trim() && !phoneNumber.trim()) {
      setError('لطفاً فیلدهای الزامی را تکمیل کنید (نام خانوادگی یا شماره تماس الزامی است)');
      return;
    }

    try {
      setIsSubmitting(true);
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || phoneNumber.trim();

      const created = await apiClient.post<Contact>('/Contact', {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        name: fullName,
        phoneNumber: phoneNumber.trim() || undefined,
        emailAddress: emailAddress.trim() || undefined,
        accountName: accountName.trim() || undefined,
      });

      onSuccess?.(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت مخاطب جدید');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">ثبت سریع مخاطب جدید</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">نام</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="نام کوچک"
                data-testid="contact-first-name"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                نام خانوادگی <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="نام خانوادگی"
                data-testid="contact-last-name"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              شماره تماس / موبایل
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="شماره تماس یا موبایل"
                className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition font-mono"
                dir="ltr"
              />
              <Phone className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">ایمیل</label>
            <div className="relative">
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="ایمیل مخاطب"
                className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition font-mono"
                dir="ltr"
              />
              <Mail className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              شرکت یا سازمان مرتبط
            </label>
            <div className="relative">
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="نام شرکت یا سازمان"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
              <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
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
