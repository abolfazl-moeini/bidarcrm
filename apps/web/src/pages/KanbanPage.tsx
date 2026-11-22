/**
 * BidarCRM - KanbanPage Component
 *
 * Full pipeline management screen offering real-time kanban board,
 * stage-based revenue aggregations, and quick creation action.
 */

import React, { useState, useMemo } from 'react';
import { Plus, AlertCircle, RefreshCw, Columns3 } from 'lucide-react';
import { useKanbanDeals } from '../features/kanban/hooks/useKanbanDeals';
import { KanbanBoard } from '../features/kanban/components/KanbanBoard';
import { KanbanFilterBar } from '../features/kanban/components/KanbanFilterBar';
import { formatToman, toPersianDigits } from '../lib/currency';

export interface KanbanPageProps {
  onNewDeal?: () => void;
  onSelectDeal?: (dealId: string) => void;
}

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

  const [onlyRotten, setOnlyRotten] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" dir="rtl">
        <div className="h-8 w-60 bg-slate-800/80 rounded-xl" />
        <div className="flex gap-5 overflow-x-auto pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-80 h-96 bg-slate-900/80 border border-slate-800 rounded-2xl flex-shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 flex flex-col h-full" dir="rtl">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Columns3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">{pipelineTitle}</h1>
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">
                {toPersianDigits(filteredDeals.length)} معامله
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              مجموع ارزش معاملات:{' '}
              <span className="font-semibold text-slate-200 font-mono text-left" dir="ltr">
                {formatToman(totalAmount)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی بورد"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNewDeal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-sm transition cursor-pointer"
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
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-rose-400 hover:text-rose-200 font-semibold text-xs px-2 py-0.5"
          >
            بستن
          </button>
        </div>
      )}

      {/* Interactive Kanban Board */}
      <div className="flex-1 min-h-0">
        <KanbanBoard
          stages={stages}
          deals={filteredDeals}
          onSelectDeal={onSelectDeal}
          onMoveDeal={(dealId, targetStageId, targetStageName) => {
            moveDeal(dealId, targetStageId, targetStageName).catch(() => {});
          }}
        />
      </div>
    </div>
  );
};

export default KanbanPage;
