/**
 * BidarCRM - KpiCard Component
 *
 * Displays a single key performance indicator with color accents,
 * icon badge, and Persian formatted metrics.
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
    bgIcon: 'bg-indigo-500/15',
    textIcon: 'text-indigo-400',
    border: 'border-indigo-500/20',
    accentText: 'text-indigo-400',
  },
  emerald: {
    bgIcon: 'bg-emerald-500/15',
    textIcon: 'text-emerald-400',
    border: 'border-emerald-500/20',
    accentText: 'text-emerald-400',
  },
  amber: {
    bgIcon: 'bg-amber-500/15',
    textIcon: 'text-amber-400',
    border: 'border-amber-500/20',
    accentText: 'text-amber-400',
  },
  rose: {
    bgIcon: 'bg-rose-500/15',
    textIcon: 'text-rose-400',
    border: 'border-rose-500/20',
    accentText: 'text-rose-400',
  },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'indigo',
  className = '',
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`relative overflow-hidden bg-slate-900/85 border border-slate-800/90 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition duration-150 flex flex-col justify-between ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${styles.bgIcon} ${styles.border} ${styles.textIcon}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div>
        <div className="text-2xl font-bold text-slate-100 tracking-tight mb-1">{value}</div>
        {subtitle && (
          <div className="text-xs text-slate-400 flex items-center gap-1.5 font-normal">
            <span>{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default KpiCard;
