/**
 * BidarCRM - LossReasonModal Component (GAP-01)
 *
 * Modal dialog prompted when moving a deal to 'Closed Lost' (معامله ناموفق/باخته).
 * Captures standardized loss reason and optional explanatory notes.
 */

import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

export const LOSS_REASONS = [
  { value: 'PriceTooHigh', label: 'قیمت بالا' },
  { value: 'Competitor', label: 'انتخاب رقیب' },
  { value: 'NoBudget', label: 'نبود بودجه' },
  { value: 'NoResponse', label: 'عدم پاسخگویی مشتری' },
  { value: 'NotQualified', label: 'نبود نیاز واقعی / عدم تناسب' },
  { value: 'Other', label: 'سایر موارد' },
] as const;

export interface LossReasonModalProps {
  isOpen: boolean;
  dealName?: string;
  isSubmitting?: boolean;
  onConfirm: (lossReason: string, lossReasonNote: string) => void;
  onClose: () => void;
}

export const LossReasonModal: React.FC<LossReasonModalProps> = ({
  isOpen,
  dealName = 'معامله',
  isSubmitting = false,
  onConfirm,
  onClose,
}) => {
  const [lossReason, setLossReason] = useState<string>('PriceTooHigh');
  const [lossReasonNote, setLossReasonNote] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lossReason) {
      setValidationError('لطفاً دلیل شکست معامله را انتخاب کنید.');
      return;
    }
    setValidationError(null);
    onConfirm(lossReason, lossReasonNote.trim());
  };

  return (
    <div
      data-testid="loss-reason-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loss-reason-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isSubmitting) {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="loss-reason-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                ثبت دلیل شکست معامله
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                {dealName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="انصراف"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {validationError && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{validationError}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              علت عدم موفقیت <span className="text-rose-500">*</span>
            </label>
            <select
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              disabled={isSubmitting}
              data-testid="loss-reason-select"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              {LOSS_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              توضیحات تکمیلی (اختیاری)
            </label>
            <textarea
              rows={3}
              value={lossReasonNote}
              onChange={(e) => setLossReasonNote(e.target.value)}
              disabled={isSubmitting}
              data-testid="loss-reason-note"
              placeholder="نکات مورد نظر در خصوص علت از دست رفتن معامله..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="confirm-loss-button"
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>ثبت باخت</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LossReasonModal;
