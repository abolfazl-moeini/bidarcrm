/**
 * BidarCRM - DealDetailPage Component
 *
 * 360-degree comprehensive deal view offering:
 * - Deal Sidebar (Financial amount in Toman, customer contacts with tel/mailto, rotten alert, stage actions)
 * - Quick Activity Logger (Notes, Calls, Meetings, Tasks)
 * - Vertical Interaction Stream Timeline (Shamsi dates, icons)
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { Opportunity, Note, EspoListResponse } from '../types/espocrm';
import { DealSidebar } from '../features/deals/components/DealSidebar';
import { QuickLogBar, LogType } from '../features/deals/components/QuickLogBar';
import { DealTimeline } from '../features/deals/components/DealTimeline';

export interface DealDetailPageProps {
  dealId: string;
  onBack?: () => void;
}

export const DealDetailPage: React.FC<DealDetailPageProps> = ({ dealId, onBack }) => {
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  const [localDeal, setLocalDeal] = useState<Opportunity | null>(null);

  // 1. Fetch Deal Info
  const dealQuery = useQuery<Opportunity>({
    queryKey: queryKeys.deals.detail(dealId),
    queryFn: () => apiClient.get<Opportunity>(`/Opportunity/${dealId}`),
  });

  // 2. Fetch Deal Interaction Stream
  const streamQuery = useQuery<EspoListResponse<Note>>({
    queryKey: queryKeys.deals.stream(dealId),
    queryFn: () =>
      apiClient.get<EspoListResponse<Note>>(
        `/Note?parentType=Opportunity&parentId=${dealId}&maxSize=100`
      ),
  });

  // Sync server data to local state
  useEffect(() => {
    if (dealQuery.data) {
      setLocalDeal(dealQuery.data);
    }
  }, [dealQuery.data]);

  useEffect(() => {
    if (streamQuery.data?.list) {
      setLocalNotes(streamQuery.data.list);
    }
  }, [streamQuery.data]);

  // Handle Note Submission
  const handleAddNote = async (post: string, type: LogType) => {
    const created = await apiClient.post<Note>('/Note', {
      parentType: 'Opportunity',
      parentId: dealId,
      post,
      type,
    });

    const newNote: Note = created || {
      id: `temp-${Date.now()}`,
      parentType: 'Opportunity',
      parentId: dealId,
      post,
      type,
      createdByName: 'شما',
      createdAt: new Date().toISOString(),
    };

    setLocalNotes((prev) => [newNote, ...prev]);
  };

  // Handle Mark Won
  const handleMarkWon = async () => {
    await apiClient.patch(`/Opportunity/${dealId}`, {
      stage: 'Closed Won',
    });
    setLocalDeal((prev) => (prev ? { ...prev, stage: 'Closed Won' } : null));
  };

  // Handle Mark Lost
  const handleMarkLost = async () => {
    await apiClient.patch(`/Opportunity/${dealId}`, {
      stage: 'Closed Lost',
    });
    setLocalDeal((prev) => (prev ? { ...prev, stage: 'Closed Lost' } : null));
  };

  const handleUpdateStage = async (stage: string) => {
    await apiClient.patch(`/Opportunity/${dealId}`, { stage });
    setLocalDeal((prev) => (prev ? { ...prev, stage } : null));
  };

  const isLoading = dealQuery.isLoading || streamQuery.isLoading;
  const isError = dealQuery.isError || streamQuery.isError;
  const deal = localDeal || dealQuery.data;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" dir="rtl">
        <div className="h-8 w-48 bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-36 bg-slate-900 border border-slate-800 rounded-2xl" />
            <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl" />
          </div>
          <div className="h-96 bg-slate-900 border border-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-4" dir="rtl">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>خطا در بارگذاری اطلاعات معامله یا سرور در دسترس نیست.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            dealQuery.refetch();
            streamQuery.refetch();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تلاش مجدد</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-full" dir="rtl">
      {/* Top Bar with Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="بازگشت به کاریز"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">{deal.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              کاریز: {deal.pipelineName || 'فروش اصلی'} | مرحله: {deal.stage}
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Quick Logger & Stream Timeline (Takes 2/3 width) */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          <QuickLogBar onSubmit={handleAddNote} />
          <DealTimeline notes={localNotes} />
        </div>

        {/* Right Column: Deal Summary & Actions Sidebar (Takes 1/3 width) */}
        <div className="order-1 lg:order-2">
          <DealSidebar
            deal={deal}
            onUpdateStage={handleUpdateStage}
            onMarkWon={handleMarkWon}
            onMarkLost={handleMarkLost}
          />
        </div>
      </div>
    </div>
  );
};

export default DealDetailPage;
