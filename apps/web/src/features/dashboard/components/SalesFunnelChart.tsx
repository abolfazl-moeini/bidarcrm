/**
 * BidarCRM - SalesFunnelChart Component
 *
 * Visualizes pipeline deal distribution across sales funnel stages
 * with horizontal progression bars and Persian currency formatting.
 */

import React from 'react';
import { Filter } from 'lucide-react';
import { formatToman, toPersianDigits } from '../../../lib/currency';

export interface FunnelStage {
  stageId: string;
  stageName: string;
  count: number;
  amount: number;
  color?: string;
}

export interface SalesFunnelChartProps {
  stages: FunnelStage[];
  className?: string;
}

const DEFAULT_STAGE_COLORS = ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#14b8a6'];

export const SalesFunnelChart: React.FC<SalesFunnelChartProps> = ({ stages, className = '' }) => {
  const maxAmount = Math.max(...stages.map((s) => s.amount), 1);

  return (
    <div
      className={`bg-slate-900/85 border border-slate-800/90 rounded-2xl p-6 shadow-sm ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-6 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">قیف فروش معاملات</h3>
            <p className="text-[11px] text-slate-500">حجم و ارزش معاملات به تفکیک مراحل کاریز</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium bg-slate-800/70 px-2.5 py-1 rounded-lg">
          {toPersianDigits(stages.length)} مرحله
        </span>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const color = stage.color || DEFAULT_STAGE_COLORS[index % DEFAULT_STAGE_COLORS.length];
          const percentage = Math.max(Math.round((stage.amount / maxAmount) * 100), 12);

          return (
            <div key={stage.stageId || index} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-semibold text-slate-200">{stage.stageName}</span>
                  <span className="text-slate-500 text-[11px]">
                    ({toPersianDigits(stage.count)} معامله)
                  </span>
                </div>
                <span className="font-medium text-slate-300 font-mono text-left" dir="ltr">
                  {formatToman(stage.amount)}
                </span>
              </div>

              {/* Funnel Progress Bar */}
              <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}

        {stages.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">
            هیچ مرحله‌ای برای نمایش در کاریز موجود نیست.
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesFunnelChart;
