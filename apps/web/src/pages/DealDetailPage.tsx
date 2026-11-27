/**
 * BidarCRM - DealDetailPage Component
 *
 * 360-degree comprehensive deal view offering:
 * - Deal Sidebar (Financial amount in Toman, customer contacts with tel/mailto, rotten alert, stage actions)
 * - Quick Activity Logger (Notes, Calls, Meetings, Tasks with attachment and status handling)
 * - Deal Products & Items Manager (DealItemsPanel - GAP-02)
 * - Pin shortcut toggle (GAP-08)
 * - Vertical Interaction Stream Timeline (Shamsi dates, icons)
 * - Didar-inspired 2-column layout and light/dark mode adaptation
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, AlertCircle, RefreshCw, Pin } from 'lucide-react';
import { apiClient, ApiError } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { Opportunity, Note, PipelineStage, EspoListResponse } from '../types/espocrm';
import { DEFAULT_PIPELINE_STAGES, resolveEspoStageEnum } from '../features/kanban/hooks/useKanbanDeals';
import { authStore } from '../features/auth/authStore';
import { DealSidebar } from '../features/deals/components/DealSidebar';
import { QuickLogBar, LogType, QuickLogBarExtra } from '../features/deals/components/QuickLogBar';
import { DealTimeline } from '../features/deals/components/DealTimeline';
import { LossReasonModal } from '../features/deals/components/LossReasonModal';
import { DealItemsPanel } from '../features/deals/components/DealItemsPanel';
import { isItemPinned, togglePinItem } from '../lib/pinned';
import { toPersianDigits } from '../lib/currency';

export interface DealDetailPageProps {
  dealId: string;
  onBack?: () => void;
}

export const formatEspoDateTime = (input: Date | string): string => {
  const date = typeof input === 'string' ? new Date(input) : input;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

export const DealDetailPage: React.FC<DealDetailPageProps> = ({ dealId, onBack }) => {
  const queryClient = useQueryClient();
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  const [localDeal, setLocalDeal] = useState<Opportunity | null>(null);
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [pendingLossStage, setPendingLossStage] = useState<{ id?: string; name?: string } | null>(null);
  const [isLossSubmitting, setIsLossSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);

  // 1. Fetch Deal Info
  const dealQuery = useQuery<Opportunity>({
    queryKey: queryKeys.deals.detail(dealId),
    queryFn: () => apiClient.get<Opportunity>(`/Opportunity/${dealId}`),
  });

  // 2. Fetch Deal Interaction Stream
  const streamQuery = useQuery<EspoListResponse<Note>>({
    queryKey: queryKeys.deals.stream(dealId),
    queryFn: async () => {
      try {
        const res = await apiClient.get<EspoListResponse<Note> | Note[]>(
          `/Opportunity/${dealId}/stream`
        );
        if (Array.isArray(res)) {
          return { list: res, total: res.length };
        }
        if (res && Array.isArray(res.list)) {
          return res;
        }
        return { list: [], total: 0 };
      } catch (err: unknown) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
          return await apiClient.get<EspoListResponse<Note>>(
            `/Note?parentType=Opportunity&parentId=${dealId}&maxSize=100`
          );
        }
        throw err;
      }
    },
  });

  // 3. Fetch Pipeline Stages
  const pipelineId = localDeal?.pipelineId || dealQuery.data?.pipelineId;
  const stagesQuery = useQuery<EspoListResponse<PipelineStage>>({
    queryKey: ['pipelineStages', pipelineId || 'default'],
    queryFn: async () => {
      try {
        const pId = pipelineId;
        const endpoint =
          pId && pId !== 'default'
            ? `/PipelineStage?maxSize=100&orderBy=order&where[0][type]=equals&where[0][attribute]=pipelineId&where[0][value]=${encodeURIComponent(pId)}`
            : '/PipelineStage?maxSize=100&orderBy=order';
        return await apiClient.get<EspoListResponse<PipelineStage>>(endpoint);
      } catch {
        return { list: [], total: 0 };
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const stages: PipelineStage[] =
    stagesQuery.data?.list && stagesQuery.data.list.length > 0
      ? stagesQuery.data.list
      : DEFAULT_PIPELINE_STAGES;

  // Sync server data to local state
  useEffect(() => {
    if (dealQuery.data) {
      setLocalDeal(dealQuery.data);
      setIsPinned(isItemPinned(dealId));
    }
  }, [dealQuery.data, dealId]);

  useEffect(() => {
    if (streamQuery.data?.list) {
      setLocalNotes((prev) => {
        const serverIds = new Set(streamQuery.data.list.map((n) => n.id));
        const localActivities = prev.filter(
          (n) => !serverIds.has(n.id) && (n.type === 'Call' || n.type === 'Meeting' || n.type === 'Task')
        );
        return [...localActivities, ...streamQuery.data.list];
      });
    }
  }, [streamQuery.data]);

  // Handle pin toggle
  const handleTogglePin = () => {
    if (!deal) return;
    const nowPinned = togglePinItem({
      id: dealId,
      type: 'deal',
      title: deal.name,
      subtitle: deal.accountName || deal.stage,
      url: `/deals/${dealId}`,
    });
    setIsPinned(nowPinned);
  };

  // Quick Note & Activity submission respecting type
  const handleAddNote = async (text: string, type: LogType = 'Note', extra: QuickLogBarExtra = {}) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticNote: Note = {
      id: tempId,
      post: text,
      type: type === 'Note' ? 'Post' : type,
      createdAt: new Date().toISOString(),
      parentType: 'Opportunity',
      parentId: dealId,
      createdByName: 'شما',
    };

    setActionError(null);
    const previousDeal = localDeal;

    // Optimistically update notes
    setLocalNotes((prev) => [optimisticNote, ...prev]);

    // Optimistically clear rotten flag on the deal
    setLocalDeal((prev) =>
      prev
        ? {
            ...prev,
            isRotten: false,
            daysSinceLastActivity: 0,
            lastActivityAt: new Date().toISOString(),
          }
        : null
    );

    try {
      let created: Note;
      const currentUserId = authStore.getState().user?.id || '2b45fd50209e2a898';
      const assignedUserId = deal?.assignedUserId || currentUserId;

      if (type === 'Call') {
        // Call -> POST /Call (status: 'Held', direction, parentType: 'Opportunity', parentId)
        await apiClient.post('/Call', {
          name: text.slice(0, 80),
          description: text,
          status: 'Held',
          direction: extra?.direction || 'Outbound',
          parentType: 'Opportunity',
          parentId: dealId,
          assignedUserId,
          dateStart: extra?.dateStart ? formatEspoDateTime(extra.dateStart) : formatEspoDateTime(new Date()),
          dateEnd: extra?.dateEnd ? formatEspoDateTime(extra.dateEnd) : formatEspoDateTime(new Date(Date.now() + 5 * 60 * 1000)),
        });
        created = {
          ...optimisticNote,
          id: `call-${Date.now()}`,
          type: 'Call',
          relatedType: 'Call',
          relatedName: text,
          post: text,
        };
      } else if (type === 'Meeting') {
        // Meeting -> POST /Meeting (status: 'Held', dateStart, dateEnd, parentType: 'Opportunity', parentId)
        const start = extra?.dateStart ? formatEspoDateTime(extra.dateStart) : formatEspoDateTime(new Date());
        const end = extra?.dateEnd ? formatEspoDateTime(extra.dateEnd) : formatEspoDateTime(new Date(Date.now() + 30 * 60 * 1000));
        await apiClient.post('/Meeting', {
          name: text.slice(0, 80),
          description: text,
          status: 'Held',
          dateStart: start,
          dateEnd: end,
          parentType: 'Opportunity',
          parentId: dealId,
          assignedUserId,
        });
        created = {
          ...optimisticNote,
          id: `meeting-${Date.now()}`,
          type: 'Meeting',
          relatedType: 'Meeting',
          relatedName: text,
          post: text,
        };
      } else if (type === 'Task') {
        // Task -> POST /Task (status: 'Not Started', dateEnd, parentType: 'Opportunity', parentId)
        const due = extra?.dateEnd ? formatEspoDateTime(extra.dateEnd) : formatEspoDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
        await apiClient.post('/Task', {
          name: text.slice(0, 80),
          description: text,
          status: 'Not Started',
          dateEnd: due,
          parentType: 'Opportunity',
          parentId: dealId,
          assignedUserId,
        });
        created = {
          ...optimisticNote,
          id: `task-${Date.now()}`,
          type: 'Task',
          relatedType: 'Task',
          relatedName: text,
          post: text,
        };
      } else {
        // Note -> POST /Note (type: 'Post') + attachment file upload (POST /Attachment)
        const payload: Record<string, unknown> = {
          post: text,
          type: 'Post',
          parentType: 'Opportunity',
          parentId: dealId,
        };
        if (extra.attachmentId) {
          payload.attachmentsIds = [extra.attachmentId];
        }
        created = await apiClient.post<Note>('/Note', payload);
      }

      // Replace temp note with server note
      setLocalNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)));

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.stream(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch (err: unknown) {
      // Revert both notes and deal rotten state on failure
      setLocalNotes((prev) => prev.filter((n) => n.id !== tempId));
      setLocalDeal(previousDeal);
      setActionError(err instanceof Error ? err.message : 'خطا در ثبت فعالیت');
    }
  };

  const findScopedStageByStatus = (targetStatus: 'Closed Won' | 'Closed Lost'): PipelineStage | undefined => {
    const scoped = deal?.pipelineId
      ? stages.filter((s) => !s.pipelineId || s.pipelineId === deal.pipelineId)
      : stages;
    return scoped.find(
      (s) => s.mappedStatus === targetStatus || resolveEspoStageEnum(s.name, s.mappedStatus) === targetStatus
    );
  };

  const handleMarkWon = async () => {
    setActionError(null);
    const previousDeal = localDeal;
    const matchedWonStage = findScopedStageByStatus('Closed Won');
    const payload: Record<string, unknown> = { stage: 'Closed Won' };
    if (matchedWonStage?.id && stagesQuery.data?.list && stagesQuery.data.list.length > 0) {
      payload.pipelineStageId = matchedWonStage.id;
    }

    setLocalDeal((prev) =>
      prev
        ? {
            ...prev,
            stage: 'Closed Won',
            isRotten: false,
            ...(payload.pipelineStageId ? { pipelineStageId: String(payload.pipelineStageId) } : {}),
          }
        : null
    );

    try {
      await apiClient.patch(`/Opportunity/${dealId}`, payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch (err: unknown) {
      setLocalDeal(previousDeal);
      setActionError(err instanceof Error ? err.message : 'خطا در ثبت نتیجه معامله');
    }
  };

  const handleMarkLost = async (lossReason: string = 'Other', lossReasonNote: string = '') => {
    setActionError(null);
    setIsLossSubmitting(true);
    const previousDeal = localDeal;
    const matchedLostStage = pendingLossStage?.id
      ? stages.find((s) => s.id === pendingLossStage.id)
      : findScopedStageByStatus('Closed Lost');
    const payload: Record<string, unknown> = {
      stage: 'Closed Lost',
      lossReason,
      lossReasonNote,
    };
    if (matchedLostStage?.id && stagesQuery.data?.list && stagesQuery.data.list.length > 0) {
      payload.pipelineStageId = matchedLostStage.id;
    }

    try {
      await apiClient.patch(`/Opportunity/${dealId}`, payload);
      setLossModalOpen(false);
      setPendingLossStage(null);
      setLocalDeal((prev) =>
        prev
          ? {
              ...prev,
              stage: 'Closed Lost',
              lossReason,
              lossReasonNote,
              ...(payload.pipelineStageId ? { pipelineStageId: String(payload.pipelineStageId) } : {}),
            }
          : null
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch (err: unknown) {
      setLocalDeal(previousDeal);
      setActionError(err instanceof Error ? err.message : 'خطا در ثبت دلیل شکست معامله');
    } finally {
      setIsLossSubmitting(false);
    }
  };

  const handleUpdateStage = async (stageIdOrName: string, stageName?: string) => {
    setActionError(null);
    const targetStage = stages.find(
      (s) => s.id === stageIdOrName || s.name === stageIdOrName || s.name === stageName
    );
    const stageVal = resolveEspoStageEnum(
      targetStage?.name || stageName || stageIdOrName,
      targetStage?.mappedStatus
    );
    const stageId = targetStage?.id || (stageIdOrName.length === 17 ? stageIdOrName : undefined);

    if (stageVal === 'Closed Lost' || targetStage?.isLost) {
      setPendingLossStage({ id: stageId, name: targetStage?.name || stageName });
      setLossModalOpen(true);
      return;
    }

    const previousDeal = localDeal;
    const payload: Record<string, unknown> = {};
    if (stageId) payload.pipelineStageId = stageId;
    if (stageVal) payload.stage = stageVal;

    setLocalDeal((prev) =>
      prev ? { ...prev, stage: stageVal, pipelineStageId: stageId || prev.pipelineStageId } : null
    );

    try {
      await apiClient.patch(`/Opportunity/${dealId}`, payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch (err: unknown) {
      setLocalDeal(previousDeal);
      setActionError(err instanceof Error ? err.message : 'خطا در تغییر مرحله معامله');
    }
  };

  const isLoading = dealQuery.isLoading || streamQuery.isLoading;
  const isError = dealQuery.isError || streamQuery.isError;
  const deal = localDeal || dealQuery.data;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" dir="rtl">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
            <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
          </div>
          <div className="h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div
        className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-4"
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span>خطا در بارگذاری اطلاعات معامله یا سرور در دسترس نیست.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            dealQuery.refetch();
            streamQuery.refetch();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 transition font-medium cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تلاش مجدد</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full" dir="rtl">
      {/* Top Bar with Navigation & Pin Action */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="بازگشت به کاریز"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {deal.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              کاریز: {deal.pipelineName || 'فروش اصلی'} | مرحله: {stages.find((s) => s.id === deal.pipelineStageId || s.mappedStatus === deal.stage)?.name || deal.stage}
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleTogglePin}
            className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
              isPinned
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
            title={isPinned ? 'حذف از پین‌شده‌ها' : 'سنجاق کردن معامله'}
            aria-label="سنجاق کردن"
          >
            <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500' : ''}`} />
            <span>{isPinned ? 'پین‌شده' : 'سنجاق کردن'}</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:underline font-medium"
          >
            بستن
          </button>
        </div>
      )}

      {/* Interactive Stage Stepper */}
      <div
        data-testid="stage-stepper"
        className="bidar-stage-stepper bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 sm:p-3 rounded-2xl shadow-sm overflow-x-auto flex items-center gap-1.5 sm:gap-2"
        dir="rtl"
      >
        {stages.map((stage, idx) => {
          const isCurrent =
            deal.pipelineStageId === stage.id ||
            deal.stage === stage.name ||
            Boolean(stage.mappedStatus && deal.stage === stage.mappedStatus);
          return (
            <button
              key={stage.id}
              type="button"
              data-testid={`stepper-stage-${stage.id}`}
              onClick={() => handleUpdateStage(stage.id, stage.name)}
              className={`flex-1 min-w-[120px] sm:min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isCurrent
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/20">
                {toPersianDigits(idx + 1)}
              </span>
              <span className="truncate">{stage.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Quick Logger, Products & Stream Timeline (Takes 2/3 width) */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          <QuickLogBar onSubmit={handleAddNote} />

          {/* GAP-02: Deal Items Panel */}
          <DealItemsPanel
            dealId={dealId}
            dealName={deal.name}
            onAmountChange={(newAmount) => {
              setLocalDeal((prev) => (prev ? { ...prev, amount: newAmount } : null));
            }}
          />

          <DealTimeline notes={localNotes} />
        </div>

        {/* Right Column: Deal Summary & Actions Sidebar (Takes 1/3 width) */}
        <div className="order-1 lg:order-2">
          <DealSidebar
            deal={deal}
            stages={stages}
            onUpdateStage={handleUpdateStage}
            onMarkWon={handleMarkWon}
            onMarkLost={() => setLossModalOpen(true)}
          />
        </div>
      </div>

      {/* GAP-01: Loss Reason Modal */}
      <LossReasonModal
        isOpen={lossModalOpen}
        dealName={deal?.name}
        isSubmitting={isLossSubmitting}
        onConfirm={handleMarkLost}
        onClose={() => {
          setLossModalOpen(false);
          setPendingLossStage(null);
        }}
      />
    </div>
  );
};

export default DealDetailPage;
