/**
 * BidarCRM - DealCard Component
 *
 * Renders an individual deal card with Didar-inspired sales ergonomics,
 * dark/light adaptive styling, HTML5 draggable support, and formatted currency.
 */

import React, { useRef, useEffect } from 'react';
import { Building2, User, Clock } from 'lucide-react';
import { Opportunity } from '../../../types/espocrm';
import { formatToman } from '../../../lib/currency';
import { RottenBadge } from './RottenBadge';

export interface DealCardProps {
  deal: Opportunity;
  className?: string;
  onClick?: () => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, className = '', onClick }) => {
  const isDraggingRef = useRef(false);
  const dragResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dragResetTimerRef.current) {
        clearTimeout(dragResetTimerRef.current);
      }
    };
  }, []);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (dragResetTimerRef.current) {
      clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
    isDraggingRef.current = true;
    e.dataTransfer.setData('application/x-bidar-deal', deal.id);
    e.dataTransfer.setData('text/plain', deal.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    if (dragResetTimerRef.current) {
      clearTimeout(dragResetTimerRef.current);
    }
    // Suppress accidental click events fired immediately on drag release
    dragResetTimerRef.current = setTimeout(() => {
      isDraggingRef.current = false;
      dragResetTimerRef.current = null;
    }, 100);
  };

  const handleClick = () => {
    if (isDraggingRef.current) {
      return;
    }
    onClick?.();
  };

  const hasCustomer = Boolean(deal.accountName || deal.contactName);

  return (
    <div
      data-testid={`deal-card-${deal.id}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={`bidar-deal-card group relative bg-white dark:bg-slate-800/95 hover:bg-slate-50/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${className}`}
      dir="rtl"
    >
      {/* Top Row: Deal Name & Rotten Flag */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-relaxed">
          {deal.name}
        </h4>
        <RottenBadge deal={deal} />
      </div>

      {/* Customer / Account Link */}
      {hasCustomer && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-2.5 truncate">
          {deal.accountName ? (
            <>
              <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              <span className="truncate font-medium">{deal.accountName}</span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              <span className="truncate font-medium">{deal.contactName}</span>
            </>
          )}
        </div>
      )}

      {/* Footer: Amount & Last Activity */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/70 text-xs">
        <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono text-left" dir="ltr">
          {formatToman(deal.amount || 0)}
        </span>

        {deal.daysSinceLastActivity !== undefined && deal.daysSinceLastActivity > 0 && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{deal.daysSinceLastActivity} روز پیش</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default DealCard;
