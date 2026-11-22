/**
 * BidarCRM - KanbanFilterBar Component
 *
 * Provides real-time filtering for deals in the kanban pipeline:
 * - Search by deal title or associated account/contact
 * - One-click toggle for rotten deals requiring urgent attention
 * - Pipeline selector switcher
 */

import React from 'react';
import { Search, Flame, X } from 'lucide-react';
import { Pipeline } from '../../../types/espocrm';
import { PipelineSelector } from './PipelineSelector';

export interface KanbanFilterBarProps {
  pipelines: Pipeline[];
  selectedPipelineId: string;
  onSelectPipeline: (pipelineId: string) => void;
  onlyRotten: boolean;
  onToggleOnlyRotten: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

export const KanbanFilterBar: React.FC<KanbanFilterBarProps> = ({
  pipelines,
  selectedPipelineId,
  onSelectPipeline,
  onlyRotten,
  onToggleOnlyRotten,
  searchQuery,
  onSearchChange,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl ${className}`}
      dir="rtl"
    >
      {/* Left (RTL Right): Pipeline Selector & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
        {pipelines.length > 0 && (
          <PipelineSelector
            pipelines={pipelines}
            selectedPipelineId={selectedPipelineId}
            onSelectPipeline={onSelectPipeline}
          />
        )}

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="جستجو در معاملات (عنوان، مشتری)..."
            className="w-full pr-9 pl-8 py-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 transition outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-0.5 cursor-pointer"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right (RTL Left): Filter Toggles */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleOnlyRotten}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition cursor-pointer ${
            onlyRotten
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
          title="فیلتر معاملات راکد و نیازمند پیگیری فوری"
        >
          <Flame
            className={`w-3.5 h-3.5 ${
              onlyRotten ? 'text-rose-400 animate-pulse' : 'text-slate-500'
            }`}
          />
          <span>فقط معاملات راکد / نیازمند اقدام</span>
        </button>
      </div>
    </div>
  );
};

export default KanbanFilterBar;
