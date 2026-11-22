/**
 * BidarCRM - DealCard Component
 *
 * Renders an individual deal card within the sales kanban board.
 * Implements HTML5 draggable interactions, customer chips, and formatted currency.
 */

import React from 'react';
import { Building2, User, Flame, Clock } from 'lucide-react';
import { Opportunity } from '../../../types/espocrm';
import { formatToman, toPersianDigits } from '../../../lib/currency';

export interface DealCardProps {
  deal: Opportunity;
  className?: string;
  onClick?: () => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, className = '', onClick }) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', deal.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const hasCustomer = Boolean(deal.accountName || deal.contactName);

  return (
    <div
      data-testid={`deal-card-${deal.id}`}
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`bidar-deal-card bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing select-none group relative ${className}`}
      dir="rtl"
    >
      {/* Top Row: Deal Name & Rotten Flag */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition line-clamp-2 leading-relaxed">
          {deal.name}
        </h4>
        {deal.isRotten && (
          <span
            className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-medium"
            title="معامله بدون فعالیت معوق (پوسیده)"
          >
            <Flame className="w-3 h-3" />
            <span>پوسیده</span>
          </span>
        )}
      </div>

      {/* Customer / Account Link */}
      {hasCustomer && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-3 truncate">
          {deal.accountName ? (
            <>
              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="truncate">{deal.accountName}</span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="truncate">{deal.contactName}</span>
            </>
          )}
        </div>
      )}

      {/* Footer: Amount & Last Activity */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
        <span className="font-semibold text-slate-200 font-mono text-left" dir="ltr">
          {formatToman(deal.amount || 0)}
        </span>

        {deal.daysSinceLastActivity !== undefined && deal.daysSinceLastActivity > 0 && (
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{toPersianDigits(deal.daysSinceLastActivity)} روز</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default DealCard;
