/**
 * BidarCRM - DealSidebar Component
 *
 * Renders the deal details sidebar:
 * - Deal financial overview (formatted in Toman)
 * - Current stage and expected close date
 * - Contact and account direct communication links (tel:, mailto:)
 * - Rotten alert badge
 * - Stage actions (Mark Won, Mark Lost)
 * - Light and dark mode adaptive surfaces
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
import { Opportunity, PipelineStage } from '../../../types/espocrm';
import { formatToman } from '../../../lib/currency';
import { formatJalaliDate } from '../../../lib/jalali';
import { RottenBadge } from '../../kanban/components/RottenBadge';

export interface DealSidebarProps {
  deal: Opportunity & { contactPhone?: string; contactEmail?: string };
  stages?: PipelineStage[];
  onUpdateStage?: (stageId: string, stageName?: string) => void;
  onMarkWon?: () => void;
  onMarkLost?: () => void;
  className?: string;
}

export const DealSidebar: React.FC<DealSidebarProps> = ({
  deal,
  stages,
  onUpdateStage,
  onMarkWon,
  onMarkLost,
  className = '',
}) => {
  const isWon = deal.stage === 'Closed Won' || deal.stage === 'برنده';
  const isLost = deal.stage === 'Closed Lost' || deal.stage === 'باخته';

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm ${className}`}
      dir="rtl"
    >
      {/* 1. Header & Stage Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            <span>{deal.pipelineName || 'کاریز اصلی'}</span>
          </span>
          <RottenBadge deal={deal} />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">{deal.name}</h2>
      </div>

      {/* 2. Amount & Stage Highlights */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
        <div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">مبلغ معامله</span>
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono tracking-tight text-left block" dir="ltr">
            {formatToman(deal.amount || 0)}
          </span>
        </div>

        <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">مرحله فعلی:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
            {deal.stage}
          </span>
        </div>

        {stages && stages.length > 0 && onUpdateStage && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">انتقال سریع مرحله:</span>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((st) => {
                const isCurrent =
                  deal.pipelineStageId === st.id ||
                  deal.stage === st.name ||
                  Boolean(st.mappedStatus && deal.stage === st.mappedStatus);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onUpdateStage(st.id, st.name)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {st.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {deal.closeDate && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">تاریخ احتمالی:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1" dir="ltr">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{formatJalaliDate(deal.closeDate)}</span>
            </span>
          </div>
        )}

        {deal.daysSinceLastActivity !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">آخرین تعامل:</span>
            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{deal.daysSinceLastActivity} روز پیش</span>
            </span>
          </div>
        )}
      </div>

      {/* 3. Customer Contacts */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">مشتری و اطلاعات تماس</h3>

        {deal.accountName && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block">شرکت / سازمان</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{deal.accountName}</span>
            </div>
          </div>
        )}

        {deal.contactName && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block">شخص رابط</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{deal.contactName}</span>
            </div>
          </div>
        )}

        {deal.contactPhone && (
          <a
            href={`tel:${deal.contactPhone}`}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            dir="ltr"
          >
            <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-mono">{deal.contactPhone}</span>
          </a>
        )}

        {deal.contactEmail && (
          <a
            href={`mailto:${deal.contactEmail}`}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            dir="ltr"
          >
            <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-mono truncate">{deal.contactEmail}</span>
          </a>
        )}
      </div>

      {/* 4. Stage Action Buttons */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={onMarkWon}
          disabled={isWon}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
            isWon
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isWon ? 'معامله برنده شد' : 'ثبت به عنوان فروش موفق (برنده)'}</span>
        </button>

        <button
          type="button"
          onClick={onMarkLost}
          disabled={isLost}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
            isLost
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <XCircle className="w-4 h-4" />
          <span>{isLost ? 'معامله مختومه و باخته است' : 'ثبت به عنوان معامله ناموفق (باخته)'}</span>
        </button>
      </div>
    </div>
  );
};

export default DealSidebar;
