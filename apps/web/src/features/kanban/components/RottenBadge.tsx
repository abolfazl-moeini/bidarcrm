/**
 * BidarCRM - RottenBadge Component
 *
 * Displays a clean warning badge for deals requiring urgent attention or with stagnant activity.
 * Employs Bidar Rose warning styling without external legacy assets.
 */

import React from 'react';
import { Flame } from 'lucide-react';
import { toPersianDigits } from '../../../lib/currency';
import { Opportunity } from '../../../types/espocrm';

export interface RottenBadgeProps {
  deal?: Opportunity;
  isRotten?: boolean;
  daysSinceLastActivity?: number;
  className?: string;
}

export const RottenBadge: React.FC<RottenBadgeProps> = ({
  deal,
  isRotten = deal?.isRotten,
  daysSinceLastActivity = deal?.daysSinceLastActivity,
  className = '',
}) => {
  if (!isRotten) {
    return null;
  }

  const hasDays = typeof daysSinceLastActivity === 'number' && daysSinceLastActivity > 0;
  const label = hasDays
    ? `${toPersianDigits(daysSinceLastActivity)} روز بدون پیگیری`
    : 'نیازمند اقدام فوری';

  return (
    <span
      className={`bidar-rotten-badge inline-flex items-center shrink-0 whitespace-nowrap gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-medium tracking-tight ${className}`}
      title={label}
      dir="rtl"
    >
      <Flame className="w-3 h-3 text-rose-600 dark:text-rose-400 flex-shrink-0 animate-pulse" />
      <span>{label}</span>
    </span>
  );
};

export default RottenBadge;
