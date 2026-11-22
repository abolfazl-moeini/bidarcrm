/**
 * BidarCRM - DealCreateModal Component
 *
 * Quick deal creation dialog allowing sales reps to initiate opportunities:
 * - Deal Name, Amount in Toman (supports Persian digits and comma formatting)
 * - Pipeline & PipelineStage selection
 * - Expected Close Date
 * - TanStack cache invalidation for Kanban and Dashboard
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Briefcase, DollarSign, Calendar, Layers, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { queryKeys } from '../../../lib/query-keys';
import { Opportunity, Pipeline, PipelineStage, EspoListResponse } from '../../../types/espocrm';
import { DEFAULT_PIPELINE_STAGES } from '../hooks/useKanbanDeals';

export interface DealCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdDeal: Opportunity) => void;
  defaultPipelineId?: string;
  defaultStageId?: string;
}

export function parseTomanAmount(raw: string): number {
  if (!raw) return 0;
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let normalized = raw;
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i]!, String(i));
  }
  normalized = normalized.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export const DealCreateModal: React.FC<DealCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultPipelineId = '',
  defaultStageId = '',
}) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pipelineId, setPipelineId] = useState(defaultPipelineId);
  const [stageId, setStageId] = useState(defaultStageId);
  const [closeDate, setCloseDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Pipelines
  const pipelineQuery = useQuery<EspoListResponse<Pipeline>>({
    queryKey: queryKeys.pipelines.all,
    queryFn: () => apiClient.get<EspoListResponse<Pipeline>>('/Pipeline'),
    enabled: isOpen,
    staleTime: 1000 * 60 * 5,
  });

  const pipelines = pipelineQuery.data?.list || [];
  const activePipeline = pipelines.find((p) => p.id === pipelineId) || pipelines[0];

  const stages: PipelineStage[] = useMemo(() => {
    if (activePipeline?.stages && activePipeline.stages.length > 0) {
      return activePipeline.stages;
    }
    return DEFAULT_PIPELINE_STAGES;
  }, [activePipeline]);

  // Set default stage when stages load or change
  useEffect(() => {
    if (stages.length > 0 && !stageId) {
      setStageId(stages[0]!.id);
    }
  }, [stages, stageId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setAmount('');
      setPipelineId(defaultPipelineId);
      setStageId(defaultStageId);
      setCloseDate('');
      setDescription('');
      setError(null);
    }
  }, [isOpen]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('نام معامله الزامی است');
      return;
    }

    try {
      setIsSubmitting(true);
      const parsedAmount = parseTomanAmount(amount);
      const selectedStage = stages.find((s) => s.id === stageId) || stages[0];

      const payload: Record<string, unknown> = {
        name: name.trim(),
        amount: parsedAmount,
        pipelineId: pipelineId || (activePipeline?.id ?? undefined),
        pipelineStageId: selectedStage?.id,
        stage: selectedStage?.name,
        closeDate: closeDate ? `${closeDate}T00:00:00.000Z` : undefined,
        description: description.trim() || undefined,
      };

      const created = await apiClient.post<Opportunity>('/Opportunity', payload);

      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });

      onSuccess?.(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت معامله جدید');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deal-create-modal-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <h3 id="deal-create-modal-title" className="text-sm font-bold text-slate-100">
              ثبت معامله جدید
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Deal Name */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              نام معامله <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قرارداد پشتیبانی شبکه یا خرید سرور..."
              data-testid="deal-name-input"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition"
            />
          </div>

          {/* Amount (in Toman) */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              مبلغ معامله (تومان)
            </label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="۲۵,۰۰۰,۰۰۰"
                data-testid="deal-amount-input"
                className="w-full pr-3 pl-9 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition font-mono"
              />
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {amount && (
              <p className="mt-1 text-[10px] text-slate-500 font-mono" dir="rtl">
                معادل عددی: {parseTomanAmount(amount).toLocaleString('fa-IR')} تومان
              </p>
            )}
          </div>

          {/* Pipeline & Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                کاریز فروش
              </label>
              <div className="relative">
                <select
                  value={pipelineId || activePipeline?.id || ''}
                  onChange={(e) => setPipelineId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {pipelines.length === 0 && <option value="">کاریز پیش‌فرض</option>}
                </select>
                <Layers className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                مرحله کاریز
              </label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition"
              >
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expected Close Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              تاریخ پیش‌بینی بستن معامله
            </label>
            <div className="relative">
              <input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition font-mono"
              />
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              یادداشت / توضیحات
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات و نیازمندی‌های مشتری..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>ایجاد معامله</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DealCreateModal;
