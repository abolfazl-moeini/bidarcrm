/**
 * BidarCRM - LossReasonsWidget Component (GAP-03)
 *
 * Displays breakdown of lost deals by standardized reason categories
 * with counts, amounts in Toman, and visual percentage bars.
 */

import React from 'react';
import { XCircle, HelpCircle } from 'lucide-react';
import { formatToman, toPersianDigits } from '../../../lib/currency';

export interface LossReasonItem {
  reason: string;
  label: string;
  count: number;
  amount: number;
}

export interface LossReasonsWidgetProps {
  reasons?: LossReasonItem[];
  className?: string;
}

export const LossReasonsWidget: React.FC<LossReasonsWidgetProps> = ({
  reasons = [],
  className = '',
}) => {
  const totalLostCount = reasons.reduce((sum, r) => sum + r.count, 0);

  return (
    <div
      className={`report-card font-vazirmatn bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <XCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">تحلیل دلایل شکست معاملات</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">علت‌های اصلی از دست رفتن فرصت‌های فروش</p>
          </div>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
          {toPersianDigits(totalLostCount)} مورد باخته
        </span>
      </div>

      {reasons.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
          <HelpCircle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
          <span>معامله ناموفقی در این دوره گزارش نشده است.</span>
        </div>
      ) : (
        <div className="space-y-3.5" data-testid="loss-reasons-list">
          {reasons.map((item) => {
            const percentage = totalLostCount > 0 ? Math.round((item.count / totalLostCount) * 100) : 0;
            return (
              <div key={item.reason} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{toPersianDigits(item.count)} معامله</span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="font-vazirmatn tabular-nums" dir="ltr">{toPersianDigits(percentage)}٪</span>
                    {item.amount > 0 && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="font-vazirmatn tabular-nums text-slate-700 dark:text-slate-300" dir="ltr">
                          {formatToman(item.amount)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(percentage, 4)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LossReasonsWidget;
