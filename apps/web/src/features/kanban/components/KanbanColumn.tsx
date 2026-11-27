/**
 * BidarCRM - KanbanColumn Component
 *
 * Renders an individual pipeline stage column with Didar-inspired chevron header,
 * aggregated financial metrics, quick-create trigger, and responsive drag-drop zone.
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { PipelineStage, Opportunity } from '../../../types/espocrm';
import { DealCard } from './DealCard';
import { formatToman, toPersianDigits } from '../../../lib/currency';

export interface KanbanColumnProps {
  stage: PipelineStage;
  deals: Opportunity[];
  onDropDeal: (dealId: string, stageId: string, stageName: string) => void;
  onSelectDeal?: (dealId: string) => void;
  onQuickAddDeal?: (stageId: string, stageName: string) => void;
  className?: string;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stage,
  deals,
  onDropDeal,
  onSelectDeal,
  onQuickAddDeal,
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  // Match strictly by pipelineStageId when set to avoid duplicate cards across columns;
  // fall back to stage name / mappedStatus only when pipelineStageId is absent.
  const stageDeals = deals.filter((d) => {
    if (d.pipelineStageId) {
      return d.pipelineStageId === stage.id;
    }
    return (
      d.stage === stage.name ||
      Boolean(stage.mappedStatus && d.stage === stage.mappedStatus)
    );
  });

  const totalAmount = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
  const color = stage.color || '#10B981';

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const dealId =
      e.dataTransfer.getData('application/x-bidar-deal') ||
      e.dataTransfer.getData('text/plain');
    if (!dealId) return;
    if (stageDeals.some((d) => d.id === dealId)) {
      return;
    }
    if (!deals.some((d) => d.id === dealId)) {
      return;
    }
    onDropDeal(dealId, stage.id, stage.name);
  };

  return (
    <div
      data-testid={`kanban-column-${stage.id}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-72 sm:w-80 flex-shrink-0 flex flex-col bg-slate-200/50 dark:bg-slate-900/60 border rounded-2xl transition-colors duration-150 overflow-hidden ${
        isDragOver
          ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
          : 'border-slate-200/90 dark:border-slate-800/90'
      } ${className}`}
      dir="rtl"
    >
      {/* Column Stage Header - Didar Stepper Style */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 tracking-tight">
              {stage.name}
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md whitespace-nowrap inline-flex items-center shrink-0">
            {toPersianDigits(stageDeals.length)} معامله
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>مجموع ارزش:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200 font-vazirmatn tabular-nums" dir="ltr">
            {formatToman(totalAmount)}
          </span>
        </div>
      </div>

      {/* Quick Add Deal in Stage Box */}
      {onQuickAddDeal && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => onQuickAddDeal(stage.id, stage.name)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-emerald-500/50 dark:border-emerald-500/40 hover:border-emerald-600 dark:hover:border-emerald-400 bg-white/70 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-xl transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن سریع معامله</span>
          </button>
        </div>
      )}

      {/* Scrollable Deal Cards Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[140px]">
        {stageDeals.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
              معامله‌ای در این مرحله نیست
            </span>
          </div>
        ) : (
          stageDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onClick={() => onSelectDeal?.(deal.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
