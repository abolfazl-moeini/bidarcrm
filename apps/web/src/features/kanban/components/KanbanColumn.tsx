/**
 * BidarCRM - KanbanColumn Component
 *
 * Renders an individual pipeline stage column with aggregated metrics,
 * drop zone listeners, and responsive deal card container.
 */

import React, { useState } from 'react';
import { PipelineStage, Opportunity } from '../../../types/espocrm';
import { DealCard } from './DealCard';
import { formatToman, toPersianDigits } from '../../../lib/currency';

export interface KanbanColumnProps {
  stage: PipelineStage;
  deals: Opportunity[];
  onDropDeal: (dealId: string, stageId: string, stageName: string) => void;
  onSelectDeal?: (dealId: string) => void;
  className?: string;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stage,
  deals,
  onDropDeal,
  onSelectDeal,
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter deals matching this stage by ID or Name
  const stageDeals = deals.filter(
    (d) => d.pipelineStageId === stage.id || d.stage === stage.name
  );

  const totalAmount = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
  const color = stage.color || '#6366f1';

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only set false if leaving the column boundary
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const dealId = e.dataTransfer.getData('text/plain');
    if (dealId) {
      onDropDeal(dealId, stage.id, stage.name);
    }
  };

  return (
    <div
      data-testid={`kanban-column-${stage.id}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-80 flex-shrink-0 flex flex-col bg-slate-900/60 border rounded-2xl transition-colors duration-150 overflow-hidden ${
        isDragOver
          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
          : 'border-slate-800/90'
      } ${className}`}
      dir="rtl"
    >
      {/* Column Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-sm font-bold text-slate-100">{stage.name}</h3>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">
            {toPersianDigits(stageDeals.length)} معامله
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono text-left" dir="ltr">
          {formatToman(totalAmount)}
        </div>
      </div>

      {/* Deal Cards Area */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[380px] max-h-[calc(100vh-230px)]">
        {stageDeals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onClick={() => onSelectDeal?.(deal.id)}
          />
        ))}

        {stageDeals.length === 0 && (
          <div className="h-32 border-2 border-dashed border-slate-800/80 rounded-xl flex items-center justify-center text-slate-600 text-xs select-none">
            معامله‌ای در این مرحله نیست
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
