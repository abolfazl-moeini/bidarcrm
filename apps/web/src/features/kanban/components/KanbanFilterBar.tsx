/**
 * BidarCRM - KanbanFilterBar Component
 *
 * Real-time filter controls with Didar-style segmented filters,
 * pipeline selector, search bar, and rotten deal toggle.
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
      className={`flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm ${className}`}
      dir="rtl"
    >
      {/* Right side: Pipeline Selector & Search */}
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
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="جستجو در معاملات (عنوان، مشتری)..."
            className="w-full pr-9 pl-8 py-2 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 transition outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-0.5 cursor-pointer"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Left side: Segmented Filters & Rotten Quick Filter */}
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={onToggleOnlyRotten}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition duration-150 cursor-pointer ${
            onlyRotten
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800'
          }`}
          aria-pressed={onlyRotten}
        >
          <Flame
            className={`w-3.5 h-3.5 ${
              onlyRotten ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
            }`}
          />
          <span>فقط معاملات راکد</span>
        </button>
      </div>
    </div>
  );
};

export default KanbanFilterBar;
