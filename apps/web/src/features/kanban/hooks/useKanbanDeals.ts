/**
 * BidarCRM - useKanbanDeals Hook
 *
 * Coordinates multi-pipeline deal queries, stage aggregations, and optimistic
 * drag-and-drop state transitions with automatic rollback on server errors.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { queryKeys } from '../../../lib/query-keys';
import { Opportunity, Pipeline, PipelineStage, EspoListResponse } from '../../../types/espocrm';

export const ESPO_STAGE_ENUMS = [
  'Prospecting',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
] as const;

export type EspoStageEnum = (typeof ESPO_STAGE_ENUMS)[number];

function normalizePersianStageText(input: string): string {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\s]+/g, '');
}

/**
 * Deterministic ordered matchers mapping Persian/English stage labels to EspoCRM
 * Opportunity.stage enums.
 */
const STAGE_ENUM_RULES: Array<{ enumValue: EspoStageEnum; keywords: string[] }> = [
  {
    enumValue: 'Closed Lost',
    keywords: ['عدمتایید', 'تاییدنشده', 'ناموفق', 'شکست', 'باخته', 'ازدسترفته', 'لغو', 'lost'],
  },
  {
    enumValue: 'Proposal',
    keywords: ['پیشنویس', 'پیشفاکتور', 'ارسالپیشنهاد', 'پیشنهاد', 'proposal'],
  },
  {
    enumValue: 'Closed Won',
    keywords: ['برنده', 'فروشموفق', 'موفق', 'تاییدنهایی', 'تاییدمشتری', 'تاییدشد', 'تایید', 'won'],
  },
  {
    enumValue: 'Qualification',
    keywords: ['مذاکرهاولیه', 'پیگیریومذاکره', 'ارزیابی', 'واجدشرایط', 'qualification'],
  },
  {
    enumValue: 'Negotiation',
    keywords: ['مذاکرهنهایی', 'مذاکره', 'توافق', 'negotiation'],
  },
  {
    enumValue: 'Prospecting',
    keywords: ['سرنخ', 'تماساولیه', 'آشنایی', 'بالقوه', 'prospect'],
  },
];

/**
 * Resolves a pipeline stage name or mappedStatus into a valid EspoCRM Opportunity.stage enum.
 */
export function resolveEspoStageEnum(stageName: string, mappedStatus?: string): EspoStageEnum {
  const candidate = mappedStatus?.trim();
  if (candidate) {
    const exactMapped = ESPO_STAGE_ENUMS.find(
      (v) => v.toLowerCase() === candidate.toLowerCase()
    );
    if (exactMapped) {
      return exactMapped;
    }
  }

  const normalizedName = (stageName || '').trim().toLowerCase();
  const exactName = ESPO_STAGE_ENUMS.find((v) => v.toLowerCase() === normalizedName);
  if (exactName) {
    return exactName;
  }

  const combined = normalizePersianStageText(`${candidate || ''} ${stageName || ''}`);
  for (const rule of STAGE_ENUM_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      return rule.enumValue;
    }
  }

  return 'Prospecting';
}

export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'stage-1', name: 'سرنخ جدید', order: 1, color: '#6366f1', mappedStatus: 'Prospecting' },
  { id: 'stage-2', name: 'مذاکره اولیه', order: 2, color: '#3b82f6', mappedStatus: 'Qualification' },
  { id: 'stage-3', name: 'پیش‌نویس قرارداد', order: 3, color: '#10b981', mappedStatus: 'Proposal' },
];

export interface UseKanbanDealsReturn {
  deals: Opportunity[];
  stages: PipelineStage[];
  pipelines: Pipeline[];
  selectedPipelineId: string;
  setSelectedPipelineId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  moveDeal: (
    dealId: string,
    targetStageId: string,
    targetStageName: string,
    lossReason?: string,
    lossReasonNote?: string
  ) => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

export function useKanbanDeals(initialPipelineId = ''): UseKanbanDealsReturn {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(initialPipelineId);
  const [localDeals, setLocalDeals] = useState<Opportunity[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlightMoveIdsRef = useRef<Set<string>>(new Set());

  // 1. Fetch Pipelines
  const pipelineQuery = useQuery<EspoListResponse<Pipeline>>({
    queryKey: queryKeys.pipelines.all,
    queryFn: () => apiClient.get<EspoListResponse<Pipeline>>('/Pipeline'),
    staleTime: 1000 * 60 * 5,
  });

  const pipelines = pipelineQuery.data?.list || [];
  const activePipelineId = selectedPipelineId || pipelines[0]?.id || 'default';
  const activePipeline = pipelines.find((p) => p.id === activePipelineId) || pipelines[0];

  // Fallback query for stages if pipeline response does not contain inline stages
  const stagesQuery = useQuery<EspoListResponse<PipelineStage>>({
    queryKey: ['pipelineStages', activePipelineId],
    queryFn: async () => {
      try {
        const endpoint = activePipelineId && activePipelineId !== 'default'
          ? `/PipelineStage?maxSize=100&orderBy=order&where[0][type]=equals&where[0][attribute]=pipelineId&where[0][value]=${encodeURIComponent(activePipelineId)}`
          : '/PipelineStage?maxSize=100&orderBy=order';
        return await apiClient.get<EspoListResponse<PipelineStage>>(endpoint);
      } catch {
        return { list: [], total: 0 };
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const stages = useMemo<PipelineStage[]>(() => {
    if (activePipeline?.stages && activePipeline.stages.length > 0) {
      return activePipeline.stages;
    }
    if (stagesQuery.data?.list && stagesQuery.data.list.length > 0) {
      return stagesQuery.data.list;
    }
    return DEFAULT_PIPELINE_STAGES;
  }, [activePipeline, stagesQuery.data]);

  // 2. Fetch Opportunities (EspoCRM Opportunity does not store pipelineId in DB, so query cleanly)
  const dealsQuery = useQuery<EspoListResponse<Opportunity>>({
    queryKey: queryKeys.deals.kanban(activePipelineId),
    queryFn: () => apiClient.get<EspoListResponse<Opportunity>>('/Opportunity?maxSize=200'),
    staleTime: 1000 * 60 * 2,
  });

  // Sync server deals to local state, filtering by pipelineId if set while preserving in-flight optimistic moves
  useEffect(() => {
    if (dealsQuery.data?.list) {
      const list = activePipelineId && activePipelineId !== 'default'
        ? dealsQuery.data.list.filter((d) => !d.pipelineId || d.pipelineId === activePipelineId)
        : dealsQuery.data.list;
      setLocalDeals((prev) => {
        if (inFlightMoveIdsRef.current.size === 0) return list;
        const prevMap = new Map(prev.map((d) => [d.id, d]));
        return list.map((d) => (inFlightMoveIdsRef.current.has(d.id) && prevMap.has(d.id) ? prevMap.get(d.id)! : d));
      });
    }
  }, [dealsQuery.data, activePipelineId]);

  // 3. Optimistic Move Action with Single-Item Rollback & In-Flight Guard
  const moveDeal = async (
    dealId: string,
    targetStageId: string,
    targetStageName: string,
    lossReason?: string,
    lossReasonNote?: string
  ): Promise<void> => {
    if (inFlightMoveIdsRef.current.has(dealId)) {
      return;
    }

    setErrorMessage(null);
    const previousDeal = localDeals.find((d) => d.id === dealId);
    if (previousDeal && previousDeal.pipelineStageId === targetStageId && !lossReason) {
      return;
    }

    inFlightMoveIdsRef.current.add(dealId);
    await queryClient.cancelQueries({ queryKey: queryKeys.deals.all });

    const targetStage = stages.find((s) => s.id === targetStageId || s.name === targetStageName);
    const stageValue = resolveEspoStageEnum(
      targetStage?.name || targetStageName,
      targetStage?.mappedStatus
    );

    // Optimistically update local board state
    setLocalDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              pipelineStageId: targetStageId,
              stage: stageValue,
              ...(lossReason ? { lossReason, lossReasonNote } : {}),
            }
          : d
      )
    );

    try {
      const payload: Record<string, unknown> = {};
      if (targetStageId) {
        payload.pipelineStageId = targetStageId;
      }
      if (stageValue) {
        payload.stage = stageValue;
      }
      if (lossReason) {
        payload.lossReason = lossReason;
      }
      if (lossReasonNote) {
        payload.lossReasonNote = lossReasonNote;
      }

      await apiClient.patch(`/Opportunity/${dealId}`, payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch (err: unknown) {
      // Single-item rollback on failure
      if (previousDeal) {
        setLocalDeals((prev) => prev.map((d) => (d.id === dealId ? previousDeal : d)));
      }
      setErrorMessage('خطا در انتقال معامله. تغییرات بازگردانده شد.');
      throw err;
    } finally {
      inFlightMoveIdsRef.current.delete(dealId);
    }
  };

  const refetch = async () => {
    const [, dRes] = await Promise.all([pipelineQuery.refetch(), dealsQuery.refetch()]);
    if (dRes.data?.list) {
      const list =
        activePipelineId && activePipelineId !== 'default'
          ? dRes.data.list.filter((d) => !d.pipelineId || d.pipelineId === activePipelineId)
          : dRes.data.list;
      setLocalDeals(list);
    }
  };

  const clearError = () => {
    setErrorMessage(null);
  };

  return {
    deals: localDeals,
    stages,
    pipelines,
    selectedPipelineId: activePipelineId,
    setSelectedPipelineId,
    isLoading: (dealsQuery.isLoading && localDeals.length === 0) || (pipelineQuery.isLoading && pipelines.length === 0),
    isError: dealsQuery.isError || pipelineQuery.isError,
    error: errorMessage || (dealsQuery.error instanceof Error ? dealsQuery.error.message : null),
    moveDeal,
    refetch,
    clearError,
  };
}

export default useKanbanDeals;
