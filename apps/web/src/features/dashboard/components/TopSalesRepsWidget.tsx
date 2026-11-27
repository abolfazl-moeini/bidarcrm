/**
 * BidarCRM - TopSalesRepsWidget Component
 *
 * Leaderboard table for top performing sales representatives:
 * - Sales Rep Name
 * - Achieved Revenue (Won Amount in Toman)
 * - Won Deals Count
 * - Active Deals Count
 * - Rotten Deals Alert Count
 * - Didar-inspired clean presentation with light/dark mode adaptation
 */

import React from 'react';
import { Award, User } from 'lucide-react';
import { toPersianDigits, formatCurrency } from '../../../lib/iran-format';

export interface SalesRepMetric {
  userId: string;
  userName: string;
  wonAmount: number;
  wonCount: number;
  openCount: number;
  rottenCount: number;
}

export interface TopSalesRepsWidgetProps {
  reps?: SalesRepMetric[];
  className?: string;
}

export const TopSalesRepsWidget: React.FC<TopSalesRepsWidgetProps> = ({
  reps = [],
  className = '',
}) => {
  return (
    <div
      className={`report-card font-vazirmatn bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              برترین کارشناسان فروش
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              عملکرد درآمدی و تعداد معاملات موفق کارشناسان
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse font-vazirmatn">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
              <th className="py-2 px-3 font-vazirmatn">رتبه</th>
              <th className="py-2 px-3 font-vazirmatn">کارشناس</th>
              <th className="py-2 px-3 font-vazirmatn">درآمد محقق</th>
              <th className="py-2 px-3 text-center font-vazirmatn">موفق</th>
              <th className="py-2 px-3 text-center font-vazirmatn">جاری</th>
              <th className="py-2 px-3 text-center font-vazirmatn">پوسیده</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {reps.map((rep, idx) => (
              <tr key={rep.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="py-2.5 px-3 font-vazirmatn tabular-nums font-bold text-slate-400">
                  {toPersianDigits(idx + 1)}
                </td>
                <td className="py-2.5 px-3 font-vazirmatn font-semibold text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                      {rep.userName?.charAt(0) || <User className="w-3 h-3" />}
                    </div>
                    <span>{rep.userName}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-vazirmatn tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(rep.wonAmount)}
                </td>
                <td className="py-2.5 px-3 font-vazirmatn tabular-nums text-center text-slate-700 dark:text-slate-300">
                  {toPersianDigits(rep.wonCount)}
                </td>
                <td className="py-2.5 px-3 font-vazirmatn tabular-nums text-center text-slate-500">
                  {toPersianDigits(rep.openCount)}
                </td>
                <td className="py-2.5 px-3 font-vazirmatn tabular-nums text-center">
                  {rep.rottenCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold whitespace-nowrap inline-flex items-center shrink-0">
                      {toPersianDigits(rep.rottenCount)}
                    </span>
                  ) : (
                    <span className="text-slate-400">۰</span>
                  )}
                </td>
              </tr>
            ))}

            {reps.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400 text-xs font-vazirmatn">
                  داده‌ای برای رتبه‌بندی کارشناسان در این بازه ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopSalesRepsWidget;
