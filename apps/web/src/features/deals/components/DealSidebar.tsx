/**
 * BidarCRM - DealSidebar Component
 *
 * Renders the deal details sidebar:
 * - Deal financial overview (formatted in Toman)
 * - Current stage and expected close date
 * - Contact and account direct communication links (tel:, mailto:)
 * - Rotten alert badge
 * - Stage actions (Mark Won, Mark Lost)
 */

import React from 'react';
import {
  Building2,
  User,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Tag,
  Clock,
} from 'lucide-react';
import { Opportunity } from '../../../types/espocrm';
import { formatToman, toPersianDigits } from '../../../lib/currency';
import { formatJalaliDate } from '../../../lib/jalali';
import { RottenBadge } from '../../kanban/components/RottenBadge';

export interface DealSidebarProps {
  deal: Opportunity & { contactPhone?: string; contactEmail?: string };
  onUpdateStage?: (stage: string) => void;
  onMarkWon?: () => void;
  onMarkLost?: () => void;
  className?: string;
}

export const DealSidebar: React.FC<DealSidebarProps> = ({
  deal,
  onMarkWon,
  onMarkLost,
  className = '',
}) => {
  const isWon = deal.stage === 'Closed Won' || deal.stage === 'برنده';
  const isLost = deal.stage === 'Closed Lost' || deal.stage === 'باخته';

  return (
    <div
      className={`bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-6 ${className}`}
      dir="rtl"
    >
      {/* 1. Header & Stage Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            <span>{deal.pipelineName || 'کاریز اصلی'}</span>
          </span>
          <RottenBadge deal={deal} />
        </div>
        <h2 className="text-base font-bold text-slate-100 leading-snug">{deal.name}</h2>
      </div>

      {/* 2. Amount & Stage Highlights */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
        <div>
          <span className="text-[11px] text-slate-400 block mb-0.5">مبلغ معامله</span>
          <span className="text-lg font-bold text-emerald-400 font-mono tracking-tight text-left block" dir="ltr">
            {formatToman(deal.amount || 0)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
          <span className="text-slate-400">مرحله فعلی:</span>
          <span className="font-medium text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md">
            {deal.stage || 'سرنخ اولیه'}
          </span>
        </div>

        {deal.closeDate && (
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>تاریخ پیش‌بینی بستن:</span>
            </span>
            <span className="font-medium text-slate-300">
              {formatJalaliDate(deal.closeDate)}
            </span>
          </div>
        )}

        {deal.daysSinceLastActivity !== undefined && deal.daysSinceLastActivity > 0 && (
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>آخرین تعامل:</span>
            </span>
            <span className="text-slate-400">
              {toPersianDigits(deal.daysSinceLastActivity)} روز قبل
            </span>
          </div>
        )}
      </div>

      {/* 3. Customer & Contact Details */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          اطلاعات مشتری و مخاطب
        </h3>

        {deal.accountName && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/50 text-xs">
            <Building2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="text-slate-300 font-medium truncate">{deal.accountName}</span>
          </div>
        )}

        {deal.contactName && (
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/50 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <User className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{deal.contactName}</span>
            </div>

            {deal.contactPhone && (
              <div className="pt-1 border-t border-slate-800/60">
                <a
                  href={`tel:${deal.contactPhone}`}
                  className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition"
                  dir="ltr"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-500/80" />
                  <span>{deal.contactPhone}</span>
                </a>
              </div>
            )}

            {deal.contactEmail && (
              <div className="pt-1">
                <a
                  href={`mailto:${deal.contactEmail}`}
                  className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition truncate"
                  dir="ltr"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-400/80 flex-shrink-0" />
                  <span className="truncate">{deal.contactEmail}</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Stage Status Actions (Won / Lost) */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 block mb-2">عملیات بستن معامله</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onMarkWon}
            disabled={isWon}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer ${
              isWon
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 cursor-default'
                : 'bg-emerald-600/10 hover:bg-emerald-600/20 active:bg-emerald-600/30 border-emerald-500/30 text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isWon ? 'برنده شد' : 'برنده (Won)'}</span>
          </button>

          <button
            type="button"
            onClick={onMarkLost}
            disabled={isLost}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer ${
              isLost
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 cursor-default'
                : 'bg-rose-600/10 hover:bg-rose-600/20 active:bg-rose-600/30 border-rose-500/30 text-rose-400'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>{isLost ? 'باخته شد' : 'باخته (Lost)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DealSidebar;
