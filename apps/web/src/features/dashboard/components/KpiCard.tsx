/**
 * BidarCRM - KpiCard Component
 *
 * Displays a single key performance indicator with Didar-inspired KPI strip,
 * light and dark mode adaptive surfaces, and formatted metrics.
 */

import React from 'react';

export type KpiVariant = 'indigo' | 'emerald' | 'amber' | 'rose';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: KpiVariant;
  className?: string;
}

const VARIANT_STYLES: Record<
  KpiVariant,
  {
    bgIcon: string;
    textIcon: string;
    border: string;
    accentText: string;
  }
> = {
  indigo: {
    bgIcon: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    textIcon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  emerald: {
    bgIcon: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    textIcon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    bgIcon: 'bg-amber-500/10 dark:bg-amber-500/15',
    textIcon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  rose: {
    bgIcon: 'bg-rose-500/10 dark:bg-rose-500/15',
    textIcon: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
    accentText: 'text-rose-600 dark:text-rose-400',
  },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'emerald',
  className = '',
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`report-card font-vazirmatn relative overflow-hidden bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</span>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${styles.bgIcon} ${styles.border} ${styles.textIcon}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div>
        <div className="kpi-value text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-1 font-vazirmatn tabular-nums">
          {value}
        </div>
        {subtitle && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-normal">
            <span>{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default KpiCard;
