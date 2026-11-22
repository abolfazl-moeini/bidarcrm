/**
 * BidarCRM - useKanbanDeals Hook
 *
 * Coordinates multi-pipeline deal queries, stage aggregations, and optimistic
 * drag-and-drop state transitions with automatic rollback on server errors.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { queryKeys } from '../../../lib/query-keys';
import { Opportunity, Pipeline, PipelineStage, EspoListResponse } from '../../../types/espocrm';

export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'stage-1', name: 'سرنخ جدید', order: 1, color: '#6366f1' },
  { id: 'stage-2', name: 'مذاکره اولیه', order: 2, color: '#3b82f6' },
  { id: 'stage-3', name: 'پیش‌نویس قرارداد', order: 3, color: '#10b981' },
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
  moveDeal: (dealId: string, targetStageId: string, targetStageName: string) => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

export function useKanbanDeals(initialPipelineId = ''): UseKanbanDealsReturn {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(initialPipelineId);
  const [localDeals, setLocalDeals] = useState<Opportunity[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Pipelines
  const pipelineQuery = useQuery<EspoListResponse<Pipeline>>({
    queryKey: queryKeys.pipelines.all,
    queryFn: () => apiClient.get<EspoListResponse<Pipeline>>('/Pipeline'),
    staleTime: 1000 * 60 * 5,
  });

  const pipelines = pipelineQuery.data?.list || [];
  const activePipelineId = selectedPipelineId || pipelines[0]?.id || 'default';
  const activePipeline = pipelines.find((p) => p.id === activePipelineId) || pipelines[0];

  const hasInlineStages = Boolean(activePipeline?.stages && activePipeline.stages.length > 0);

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
    enabled: !hasInlineStages && pipelines.length > 0,
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

  // 2. Fetch Opportunities (filtered by pipelineId if active)
  const dealsQuery = useQuery<EspoListResponse<Opportunity>>({
    queryKey: queryKeys.deals.kanban(activePipelineId),
    queryFn: () => {
      const endpoint = activePipelineId && activePipelineId !== 'default'
        ? `/Opportunity?maxSize=200&where[0][type]=equals&where[0][attribute]=pipelineId&where[0][value]=${encodeURIComponent(activePipelineId)}`
        : '/Opportunity?maxSize=200';
      return apiClient.get<EspoListResponse<Opportunity>>(endpoint);
    },
  });

  // Sync server deals to local state, filtering by pipelineId if set
  useEffect(() => {
    if (dealsQuery.data?.list) {
      const list = activePipelineId && activePipelineId !== 'default'
        ? dealsQuery.data.list.filter((d) => !d.pipelineId || d.pipelineId === activePipelineId)
        : dealsQuery.data.list;
      setLocalDeals(list);
    }
  }, [dealsQuery.data, activePipelineId]);

  // 3. Optimistic Move Action with Rollback & Invalidation
  const moveDeal = async (
    dealId: string,
    targetStageId: string,
    targetStageName: string
  ): Promise<void> => {
    setErrorMessage(null);
    const previousSnapshot = [...localDeals];

    // Optimistically update local board state
    setLocalDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, pipelineStageId: targetStageId, stage: targetStageName }
          : d
      )
    );

    try {
      const payload: Record<string, unknown> = {};
      if (targetStageId) {
        payload.pipelineStageId = targetStageId;
      }
      if (targetStageName) {
        payload.stage = targetStageName;
      }

      await apiClient.patch(`/Opportunity/${dealId}`, payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.kanban(activePipelineId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch (err: unknown) {
      // Rollback on failure
      setLocalDeals(previousSnapshot);
      setErrorMessage('خطا در انتقال معامله. تغییرات بازگردانده شد.');
      throw err;
    }
  };

  const refetch = async () => {
    await Promise.all([pipelineQuery.refetch(), dealsQuery.refetch()]);
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
    isLoading: dealsQuery.isLoading || pipelineQuery.isLoading,
    isError: dealsQuery.isError || pipelineQuery.isError,
    error: errorMessage || (dealsQuery.error instanceof Error ? dealsQuery.error.message : null),
    moveDeal,
    refetch,
    clearError,
  };
}

export default useKanbanDeals;
