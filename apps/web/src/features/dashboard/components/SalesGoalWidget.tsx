/**
 * BidarCRM - SalesGoalWidget Component (GAP-07)
 *
 * Visualizes sales goal progress bar with target, achieved revenue in Toman,
 * percentage completion, and remaining revenue gap.
 */

import React from 'react';
import { Target, TrendingUp, CheckCircle } from 'lucide-react';
import { formatToman, toPersianDigits } from '../../../lib/currency';

export interface SalesGoalWidgetProps {
  goalName?: string;
  targetAmount?: number;
  currentAmount?: number;
  className?: string;
}

export const SalesGoalWidget: React.FC<SalesGoalWidgetProps> = ({
  goalName = 'هدف فروش ماه جاری',
  targetAmount = 100000000, // 100 million Toman default benchmark if not specified
  currentAmount = 0,
  className = '',
}) => {
  const target = Math.max(targetAmount, 1);
  const percentage = Math.min(100, Math.round((currentAmount / target) * 100));
  const remaining = Math.max(0, target - currentAmount);
  const isReached = currentAmount >= target;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 ${className}`}
      dir="rtl"
      data-testid="sales-goal-widget"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{goalName}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">پیشرفت تحقق تارگت درآمدی</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/80 px-2.5 py-1 rounded-lg font-mono" dir="ltr">
          {isReached ? <CheckCircle className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
          <span>{toPersianDigits(percentage)}٪</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            data-testid="sales-goal-progress-bar"
            className={`h-full rounded-full transition-all duration-500 ${
              isReached
                ? 'bg-emerald-500'
                : percentage >= 60
                ? 'bg-teal-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>

        {/* Financial Breakdown */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">مبلغ محقق‌شده</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono" dir="ltr">
              {formatToman(currentAmount)}
            </span>
          </div>

          <div className="text-center">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">هدف کل</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono" dir="ltr">
              {formatToman(target)}
            </span>
          </div>

          <div className="text-left">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">باقی‌مانده تا هدف</span>
            <span className="font-semibold text-slate-600 dark:text-slate-400 font-mono" dir="ltr">
              {remaining > 0 ? formatToman(remaining) : 'هدف محقق شد!'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesGoalWidget;
