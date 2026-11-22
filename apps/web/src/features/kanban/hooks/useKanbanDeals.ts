/**
 * BidarCRM - useKanbanDeals Hook
 *
 * Coordinates multi-pipeline deal queries, stage aggregations, and optimistic
 * drag-and-drop state transitions with automatic rollback on server errors.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  moveDeal: (dealId: string, targetStageId: string, targetStageName: string) => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

export function useKanbanDeals(pipelineId = 'default'): UseKanbanDealsReturn {
  const [localDeals, setLocalDeals] = useState<Opportunity[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Pipelines & Stages
  const pipelineQuery = useQuery<EspoListResponse<Pipeline>>({
    queryKey: queryKeys.pipelines.all,
    queryFn: () => apiClient.get<EspoListResponse<Pipeline>>('/Pipeline'),
    staleTime: 1000 * 60 * 5,
  });

  const stages = useMemo<PipelineStage[]>(() => {
    const pipelines = pipelineQuery.data?.list || [];
    const activePipeline = pipelines.find((p) => p.id === pipelineId) || pipelines[0];
    if (activePipeline?.stages && activePipeline.stages.length > 0) {
      return activePipeline.stages;
    }
    return DEFAULT_PIPELINE_STAGES;
  }, [pipelineQuery.data, pipelineId]);

  // 2. Fetch Opportunities
  const dealsQuery = useQuery<EspoListResponse<Opportunity>>({
    queryKey: queryKeys.deals.kanban(pipelineId),
    queryFn: () => apiClient.get<EspoListResponse<Opportunity>>('/Opportunity?maxSize=200'),
  });

  // Sync server deals to local state
  useEffect(() => {
    if (dealsQuery.data?.list) {
      setLocalDeals(dealsQuery.data.list);
    }
  }, [dealsQuery.data]);

  // 3. Optimistic Move Action with Rollback
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
      await apiClient.patch(`/Opportunity/${dealId}`, {
        pipelineStageId: targetStageId,
        stage: targetStageName,
      });
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
    isLoading: dealsQuery.isLoading || pipelineQuery.isLoading,
    isError: dealsQuery.isError || pipelineQuery.isError,
    error: errorMessage || (dealsQuery.error instanceof Error ? dealsQuery.error.message : null),
    moveDeal,
    refetch,
    clearError,
  };
}

export default useKanbanDeals;
