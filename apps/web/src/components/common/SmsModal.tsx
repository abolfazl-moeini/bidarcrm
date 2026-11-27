/**
 * BidarCRM - SmsModal Component
 *
 * Dedicated Iranian SMS dispatch modal dialog:
 * - Recipient phone number (supports Persian/English formatting)
 * - Template selection from BidarSmsTemplate
 * - Automatic variable replacement ({name}, {accountName})
 * - Persian character counter & page calculator (70 chars first page, 67 subsequent pages)
 * - Single/bulk send via POST /api/v1/BidarSms/send
 * - Clean Didar styling with light/dark mode support
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { BidarSmsTemplate, EspoListResponse } from '../../types/espocrm';
import { toPersianDigits } from '../../lib/iran-format';

export interface SmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientPhone?: string;
  recipientName?: string;
  accountName?: string;
  onSuccess?: () => void;
}

export function calculatePersianSmsPages(charCount: number): { pages: number; remainingInPage: number } {
  if (charCount <= 0) return { pages: 1, remainingInPage: 70 };
  if (charCount <= 70) {
    return { pages: 1, remainingInPage: 70 - charCount };
  }
  const pages = Math.ceil(charCount / 67);
  const remainingInPage = pages * 67 - charCount;
  return { pages, remainingInPage };
}

export const SmsModal: React.FC<SmsModalProps> = ({
  isOpen,
  onClose,
  recipientPhone = '',
  recipientName = '',
  accountName = '',
  onSuccess,
}) => {
  const [phone, setPhone] = useState(recipientPhone);
  const [message, setMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Fetch SMS Templates
  const templatesQuery = useQuery<EspoListResponse<BidarSmsTemplate>>({
    queryKey: ['smsTemplates', 'active'],
    queryFn: async () => {
      try {
        return await apiClient.get<EspoListResponse<BidarSmsTemplate>>(
          '/BidarSmsTemplate?maxSize=50'
        );
      } catch {
        return { list: [], total: 0 };
      }
    },
    enabled: isOpen,
  });

  const templates = templatesQuery.data?.list || [];

  useEffect(() => {
    if (isOpen) {
      setPhone(recipientPhone);
      setMessage('');
      setSelectedTemplateId('');
      setError(null);
      setSentSuccess(false);
    }
  }, [isOpen, recipientPhone]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSending, onClose]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      let body = tmpl.body || '';
      // Variable replacement
      body = body.replaceAll('{name}', recipientName || 'مشتری گرامی');
      body = body.replaceAll('{contactName}', recipientName || 'مشتری گرامی');
      body = body.replaceAll('{accountName}', accountName || 'مجموعه محترم');
      setMessage(body);
    }
  };

  const { pages, remainingInPage } = useMemo(
    () => calculatePersianSmsPages(message.length),
    [message.length]
  );

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.trim();
    const cleanMsg = message.trim();

    if (!cleanPhone) {
      setError('شماره گیرنده الزامی است.');
      return;
    }
    if (!cleanMsg) {
      setError('متن پیامک نمی‌تواند خالی باشد.');
      return;
    }

    setIsSending(true);
    try {
      await apiClient.post('/BidarSms/send', {
        phone: cleanPhone,
        recipient: cleanPhone,
        message: cleanMsg,
        templateId: selectedTemplateId || undefined,
      });

      setSentSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارسال پیامک از طریق سامانه.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sms-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 id="sms-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                ارسال پیامک مستقیم
              </h3>
              {recipientName && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">به: {recipientName}</p>
              )}
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

        {/* Success Alert */}
        {sentSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>پیامک با موفقیت در صف ارسال درگاه قرار گرفت.</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-3.5">
          {/* Recipient Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              شماره گیرنده <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09121234567"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
            />
          </div>

          {/* Template Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>انتخاب از قالب‌های آماده:</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
            >
              <option value="">— نگارش پیام آزاد یا انتخاب الگو —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Message Textarea */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              متن پیامک <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="متن پیامک را اینجا بنویسید..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none resize-none"
            />

            {/* Persian Counter Info */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              <span>
                تعداد کاراکتر: <strong className="font-mono text-slate-800 dark:text-slate-200">{toPersianDigits(message.length)}</strong> ({toPersianDigits(remainingInPage)} کاراکتر تا صفحه بعد)
              </span>
              <span>
                تعداد بخش پیامک: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{toPersianDigits(pages)}</strong> صفحه
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSending || sentSuccess}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 rotate-180" />}
              <span>ارسال پیامک</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SmsModal;
