/**
 * BidarCRM - KanbanPage Component
 *
 * Full pipeline management screen offering:
 * - Didar-inspired sales kanban board with stage aggregations
 * - GAP-01: Loss Reason selector when moving deals to Closed Lost
 * - GAP-06: Forecast (پیش‌بینی) view tab grouping deals by Jalali month of closeDate
 * - Dark/light adaptive theming and quick creation actions
 */

import React, { useState, useMemo } from 'react';
import { Plus, AlertCircle, RefreshCw, Columns3, TrendingUp, Calendar } from 'lucide-react';
import { useKanbanDeals } from '../features/kanban/hooks/useKanbanDeals';
import { KanbanBoard } from '../features/kanban/components/KanbanBoard';
import { KanbanFilterBar } from '../features/kanban/components/KanbanFilterBar';
import { DealCard } from '../features/kanban/components/DealCard';
import { DealCreateModal } from '../features/kanban/components/DealCreateModal';
import { LossReasonModal } from '../features/deals/components/LossReasonModal';
import { formatToman, toPersianDigits } from '../lib/currency';
import { getJalaliParts, PERSIAN_MONTH_NAMES } from '../lib/jalali';
import { Opportunity } from '../types/espocrm';

export interface KanbanPageProps {
  onNewDeal?: () => void;
  onSelectDeal?: (dealId: string) => void;
}

export type KanbanViewMode = 'kanban' | 'forecast';

export const KanbanPage: React.FC<KanbanPageProps> = ({ onNewDeal, onSelectDeal }) => {
  const {
    deals,
    stages,
    pipelines,
    selectedPipelineId,
    setSelectedPipelineId,
    isLoading,
    error,
    moveDeal,
    refetch,
    clearError,
  } = useKanbanDeals();

  const [viewMode, setViewMode] = useState<KanbanViewMode>('kanban');
  const [onlyRotten, setOnlyRotten] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // GAP-01: Loss reason modal state
  const [pendingLoss, setPendingLoss] = useState<{
    dealId: string;
    dealName: string;
    targetStageId: string;
    targetStageName: string;
  } | null>(null);

  // Quick deal creation modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>();

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const pipelineTitle = activePipeline?.name || 'کاریز فروش اصلی';

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (onlyRotten && !deal.isRotten) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = deal.name?.toLowerCase().includes(q);
        const matchesAccount = deal.accountName?.toLowerCase().includes(q);
        const matchesContact = deal.contactName?.toLowerCase().includes(q);
        if (!matchesName && !matchesAccount && !matchesContact) {
          return false;
        }
      }
      return true;
    });
  }, [deals, onlyRotten, searchQuery]);

  const totalAmount = filteredDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

  // GAP-06: Group deals by Jalali month for Forecast view
  const forecastMonths = useMemo(() => {
    const groups: Record<
      string,
      { key: string; label: string; year: number; month: number; deals: Opportunity[]; totalAmount: number }
    > = {};

    const unscheduled: Opportunity[] = [];

    for (const deal of filteredDeals) {
      if (!deal.closeDate) {
        unscheduled.push(deal);
        continue;
      }

      try {
        const d = new Date(deal.closeDate);
        if (isNaN(d.getTime())) {
          unscheduled.push(deal);
          continue;
        }
        const { year, month } = getJalaliParts(d);
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const monthName = PERSIAN_MONTH_NAMES[month - 1] || 'ماه';
        const label = `${monthName} ${toPersianDigits(year)}`;

        if (!groups[key]) {
          groups[key] = { key, label, year, month, deals: [], totalAmount: 0 };
        }
        groups[key].deals.push(deal);
        groups[key].totalAmount += deal.amount || 0;
      } catch {
        unscheduled.push(deal);
      }
    }

    const sortedGroups = Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    if (unscheduled.length > 0) {
      const unscheduledAmount = unscheduled.reduce((sum, d) => sum + (d.amount || 0), 0);
      sortedGroups.push({
        key: 'unscheduled',
        label: 'بدون تاریخ سررسید',
        year: 9999,
        month: 99,
        deals: unscheduled,
        totalAmount: unscheduledAmount,
      });
    }

    return sortedGroups;
  }, [filteredDeals]);

  // Handle stage move and intercept Closed Lost
  const handleMoveDeal = (dealId: string, targetStageId: string, targetStageName: string) => {
    const targetStage = stages.find((s) => s.id === targetStageId || s.name === targetStageName);
    const isLost =
      targetStage?.mappedStatus === 'Closed Lost' ||
      targetStageName.includes('ناموفق') ||
      targetStageName.includes('شکست') ||
      targetStageName.includes('باخته') ||
      targetStageName.includes('از دست رفته') ||
      targetStageName.toLowerCase().includes('lost') ||
      targetStageName === 'Closed Lost';

    if (isLost) {
      const targetDeal = deals.find((d) => d.id === dealId);
      setPendingLoss({
        dealId,
        dealName: targetDeal?.name || 'معامله',
        targetStageId,
        targetStageName,
      });
      return;
    }

    moveDeal(dealId, targetStageId, targetStageName).catch(() => {});
  };

  const handleQuickAdd = (stageId: string, _stageName: string) => {
    setCreateStageId(stageId);
    setIsCreateModalOpen(true);
  };

  const handleConfirmLoss = async (lossReason: string, lossReasonNote: string) => {
    if (!pendingLoss) return;
    const { dealId, targetStageId, targetStageName } = pendingLoss;
    setPendingLoss(null);
    await moveDeal(dealId, targetStageId, targetStageName, lossReason, lossReasonNote).catch(() => {});
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" dir="rtl">
        <div className="h-8 w-60 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="flex gap-5 overflow-x-auto pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-80 h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex-shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 flex flex-col h-full" dir="rtl">
      {/* Top Header Controls (Didar-style Toolbar) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            {viewMode === 'forecast' ? <TrendingUp className="w-5 h-5" /> : <Columns3 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {viewMode === 'forecast' ? 'پیش‌بینی فروش (ماهانه)' : pipelineTitle}
              </h1>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md whitespace-nowrap inline-flex items-center shrink-0">
                {toPersianDigits(filteredDeals.length)} معامله
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مجموع ارزش باز:{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono text-left" dir="ltr">
                {formatToman(totalAmount)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* GAP-06: View Mode Switcher Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              data-testid="view-tab-kanban"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>کاریز</span>
            </button>
            <button
              type="button"
              data-testid="view-tab-forecast"
              onClick={() => setViewMode('forecast')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'forecast'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>پیش‌بینی</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی بورد"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => (onNewDeal ? onNewDeal() : setIsCreateModalOpen(true))}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>معامله جدید</span>
          </button>
        </div>
      </div>

      {/* Filter and Pipeline Bar */}
      <KanbanFilterBar
        pipelines={pipelines}
        selectedPipelineId={selectedPipelineId}
        onSelectPipeline={setSelectedPipelineId}
        onlyRotten={onlyRotten}
        onToggleOnlyRotten={() => setOnlyRotten((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Error Alert with Dismiss */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3 transition"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 font-semibold text-xs px-2 py-0.5 cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* Board Content (Kanban vs Forecast) */}
      <div className="flex-1 min-h-0">
        {viewMode === 'kanban' ? (
          <KanbanBoard
            stages={stages}
            deals={filteredDeals}
            onSelectDeal={onSelectDeal}
            onQuickAddDeal={handleQuickAdd}
            onMoveDeal={handleMoveDeal}
          />
        ) : (
          /* GAP-06: Forecast View Columns */
          <div
            data-testid="forecast-view"
            className="flex gap-4 sm:gap-5 overflow-x-auto pb-6 items-start select-none scroll-smooth"
            dir="rtl"
          >
            {forecastMonths.length === 0 ? (
              <div className="w-full text-center py-16 text-slate-400 text-xs">
                هیچ معامله‌ای برای پیش‌بینی ثبت نشده است.
              </div>
            ) : (
              forecastMonths.map((group) => (
                <div
                  key={group.key}
                  className="w-72 sm:w-80 flex-shrink-0 bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl flex flex-col max-h-[calc(100vh-270px)]"
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-800/40 rounded-t-2xl">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {group.label}
                        </h3>
                      </div>
                      <span className="text-[11px] font-semibold bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center shrink-0">
                        {toPersianDigits(group.deals.length)}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-left" dir="ltr">
                      {formatToman(group.totalAmount)}
                    </div>
                  </div>

                  {/* Deals List */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1">
                    {group.deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onClick={onSelectDeal ? () => onSelectDeal(deal.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* GAP-01: Loss Reason Modal */}
      <LossReasonModal
        isOpen={Boolean(pendingLoss)}
        dealName={pendingLoss?.dealName}
        onConfirm={handleConfirmLoss}
        onClose={() => setPendingLoss(null)}
      />

      {/* Quick Deal Create Modal */}
      <DealCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateStageId(undefined);
        }}
        stages={stages}
        defaultPipelineId={activePipeline?.id || selectedPipelineId}
        defaultStageId={createStageId}
        onSuccess={async () => {
          await refetch();
        }}
      />
    </div>
  );
};

export default KanbanPage;
