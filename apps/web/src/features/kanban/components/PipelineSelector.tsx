/**
 * BidarCRM - PipelineSelector Component
 *
 * Allows switching between sales pipelines (e.g., Direct Sales vs Renewals)
 * with Didar-inspired modern styling and dark/light adaptive tokens.
 */

import React from 'react';
import { Columns3, ChevronDown } from 'lucide-react';
import { Pipeline } from '../../../types/espocrm';

export interface PipelineSelectorProps {
  pipelines: Pipeline[];
  selectedPipelineId: string;
  onSelectPipeline: (pipelineId: string) => void;
  className?: string;
}

export const PipelineSelector: React.FC<PipelineSelectorProps> = ({
  pipelines,
  selectedPipelineId,
  onSelectPipeline,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex items-center ${className}`} dir="rtl">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600 dark:text-emerald-400">
        <Columns3 className="w-4 h-4" />
      </div>
      <select
        aria-label="انتخاب کاریز فروش"
        value={selectedPipelineId}
        onChange={(e) => onSelectPipeline(e.target.value)}
        className="w-full sm:w-auto appearance-none pr-9 pl-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm transition cursor-pointer outline-none"
      >
        {pipelines.map((pipeline) => (
          <option
            key={pipeline.id}
            value={pipeline.id}
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1"
          >
            {pipeline.name}
          </option>
        ))}
      </select>
      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <ChevronDown className="w-3.5 h-3.5" />
      </div>
    </div>
  );
};

export default PipelineSelector;
