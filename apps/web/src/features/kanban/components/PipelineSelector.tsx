/**
 * BidarCRM - PipelineSelector Component
 *
 * Allows switching between sales pipelines (e.g., Direct Sales vs Renewals)
 * with Bidar design tokens.
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
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <Columns3 className="w-4 h-4 text-indigo-400" />
      </div>
      <select
        aria-label="انتخاب کاریز فروش"
        value={selectedPipelineId}
        onChange={(e) => onSelectPipeline(e.target.value)}
        className="w-full sm:w-auto appearance-none pr-9 pl-8 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-medium text-slate-100 transition cursor-pointer outline-none"
      >
        {pipelines.map((pipeline) => (
          <option key={pipeline.id} value={pipeline.id} className="bg-slate-900 text-slate-100 py-1">
            {pipeline.name}
          </option>
        ))}
      </select>
      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </div>
  );
};

export default PipelineSelector;
