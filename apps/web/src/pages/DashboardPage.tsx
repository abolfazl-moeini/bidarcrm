/**
 * BidarCRM - DashboardPage Component
 *
 * Primary sales operations hub displaying key performance indicators,
 * real-time sales funnel chart, and real prioritized pending action items.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, BadgeCheck, Flame, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { DashboardSummary, Task, EspoListResponse } from '../types/espocrm';
import { formatToman, toPersianDigits } from '../lib/currency';
import { KpiCard } from '../features/dashboard/components/KpiCard';
import { SalesFunnelChart } from '../features/dashboard/components/SalesFunnelChart';
import {
  PendingActivitiesWidget,
  PendingActivityItem,
} from '../features/dashboard/components/PendingActivitiesWidget';

export interface DashboardPageProps {
  onNavigate?: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  // 1. Fetch KPI Summary
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<DashboardSummary>({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => apiClient.get<DashboardSummary>('/BidarDashboard/summary'),
  });

  // 2. Fetch Real Pending Activities
  const { data: activitiesData } = useQuery<EspoListResponse<Task>>({
    queryKey: queryKeys.activities.list({ status: 'open' }),
    queryFn: async () => {
      try {
        return await apiClient.get<EspoListResponse<Task>>(
          '/Task?where[0][type]=in&where[0][attribute]=status&where[0][value][]=Not Started&where[0][value][]=Started&maxSize=10&orderBy=dateEnd'
        );
      } catch {
        return { list: [], total: 0 };
      }
    },
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading) {
    return (
      <div data-testid="dashboard-skeleton" className="space-y-6 animate-pulse" dir="rtl">
        {/* Header Skeleton */}
        <div className="h-8 w-48 bg-slate-800/80 rounded-xl" />

        {/* KPI Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-900/80 border border-slate-800 rounded-2xl p-5" />
          ))}
        </div>

        {/* Lower Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-slate-900/80 border border-slate-800 rounded-2xl" />
          <div className="h-72 bg-slate-900/80 border border-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMsg =
      error instanceof Error ? error.message : 'خطا در دریافت اطلاعات داشبورد از سرور.';

    return (
      <div
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center text-rose-300 max-w-xl mx-auto my-12"
        dir="rtl"
      >
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-200 mb-2">خطا در دریافت اطلاعات داشبورد</h3>
        <p className="text-xs text-rose-300/80 mb-6 leading-relaxed">{errorMsg}</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-xs rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>تلاش مجدد</span>
        </button>
      </div>
    );
  }

  const summary = data || {
    openCount: 0,
    openAmount: 0,
    wonCount: 0,
    wonAmount: 0,
    rottenCount: 0,
    overdueActivitiesCount: 0,
    funnelStages: [],
  };

  const pendingActivities: PendingActivityItem[] = (activitiesData?.list || []).map((t) => ({
    id: t.id,
    name: t.name,
    type: (t as any).type || ('Task' as const),
    dateDue: t.dateEnd || t.dateDue,
    status: t.status,
    priority: t.priority,
  }));

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">پیشخوان فروش بیدار</h1>
          <p className="text-xs text-slate-400 mt-1">
            خلاصه عملکرد کاریز معاملات، درآمد تحقق‌یافته و رصد لحظه‌ای اقدامات
          </p>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Open Deals */}
        <KpiCard
          title="معاملات باز"
          value={formatToman(summary.openAmount)}
          subtitle={`${toPersianDigits(summary.openCount)} معامله`}
          icon={Briefcase}
          variant="indigo"
        />

        {/* 2. Won Deals Revenue */}
        <KpiCard
          title="درآمد محقق‌شده"
          value={formatToman(summary.wonAmount)}
          subtitle={`${toPersianDigits(summary.wonCount)} موفق`}
          icon={BadgeCheck}
          variant="emerald"
        />

        {/* 3. Rotten Deals */}
        <KpiCard
          title="معاملات پوسیده"
          value={toPersianDigits(summary.rottenCount)}
          subtitle="نیازمند اقدام فوری"
          icon={Flame}
          variant="rose"
        />

        {/* 4. Overdue Activities */}
        <KpiCard
          title="فعالیت‌های معوق"
          value={toPersianDigits(summary.overdueActivitiesCount)}
          subtitle="سررسید گذشته"
          icon={Clock}
          variant="amber"
        />
      </div>

      {/* 2-Column Analytical Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Funnel Chart (2 Cols) */}
        <div className="lg:col-span-2">
          <SalesFunnelChart stages={summary.funnelStages} />
        </div>

        {/* Daily Priority Activities (1 Col) */}
        <div>
          <PendingActivitiesWidget activities={pendingActivities} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
