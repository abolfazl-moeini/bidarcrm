/**
 * BidarCRM - LeadSourcesWidget Component
 *
 * Visualizes lead acquisition sources breakdown:
 * - Channel / Source Name
 * - Deals Count
 * - Aggregate Amount in Toman
 * - Percentage share bar
 */

import React from 'react';
import { Share2 } from 'lucide-react';
import { toPersianDigits, formatCurrency } from '../../../lib/iran-format';

export interface LeadSourceMetric {
  source: string;
  label: string;
  count: number;
  amount: number;
}

export interface LeadSourcesWidgetProps {
  sources?: LeadSourceMetric[];
  className?: string;
}

export const LeadSourcesWidget: React.FC<LeadSourcesWidgetProps> = ({
  sources = [],
  className = '',
}) => {
  const totalAmount = sources.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div
      className={`report-card font-vazirmatn bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              منابع جذب سرنخ و مشتریان
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              تفکیک کانال‌های بازاریابی و ارزش مالی هر منبع
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sources.map((src) => {
          const percent = totalAmount > 0 ? Math.round((src.amount / totalAmount) * 100) : 0;
          return (
            <div key={src.source} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {src.label || src.source}
                </span>
                <div className="flex items-center gap-2 font-vazirmatn tabular-nums">
                  <span className="text-slate-500">{toPersianDigits(src.count)} معامله</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatCurrency(src.amount)}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </div>
          );
        })}

        {sources.length === 0 && (
          <div className="p-6 text-center text-slate-400 text-xs">
            اطلاعاتی از منابع سرنخ در این بازه ثبت نشده است.
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadSourcesWidget;
