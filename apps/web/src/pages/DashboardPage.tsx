/**
 * BidarCRM - DashboardPage Component
 *
 * Primary sales operations hub displaying key performance indicators,
 * real-time sales funnel chart, conversion rate, average sales cycle,
 * loss reasons breakdown, sales goal progress bar, top sales reps leaderboard,
 * lead sources breakdown, Jalali period and user filtering, and prioritized pending action items.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  BadgeCheck,
  Flame,
  Clock,
  AlertCircle,
  RefreshCw,
  Percent,
  Timer,
  User,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { DashboardSummary, Task, EspoUser, EspoListResponse } from '../types/espocrm';
import { formatToman, toPersianDigits } from '../lib/currency';
import { KpiCard } from '../features/dashboard/components/KpiCard';
import { SalesFunnelChart } from '../features/dashboard/components/SalesFunnelChart';
import {
  PendingActivitiesWidget,
  PendingActivityItem,
} from '../features/dashboard/components/PendingActivitiesWidget';
import { LossReasonsWidget } from '../features/dashboard/components/LossReasonsWidget';
import { SalesGoalWidget } from '../features/dashboard/components/SalesGoalWidget';
import { TopSalesRepsWidget } from '../features/dashboard/components/TopSalesRepsWidget';
import { LeadSourcesWidget } from '../features/dashboard/components/LeadSourcesWidget';

export interface DashboardPageProps {
  onNavigate?: (path: string) => void;
}

const JALALI_PERIODS = [
  { id: 'current_month', label: 'ماه جاری' },
  { id: 'last_month', label: 'ماه گذشته' },
  { id: 'current_quarter', label: 'فصل جاری' },
];

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [jalaliPeriod, setJalaliPeriod] = useState<string>('current_month');
  const [assignedUserId, setAssignedUserId] = useState<string>('');

  // 1. Fetch Users for User Filter
  const usersQuery = useQuery<EspoListResponse<EspoUser>>({
    queryKey: ['users', 'list'],
    queryFn: async () => {
      try {
        return await apiClient.get<EspoListResponse<EspoUser>>('/User?maxSize=50');
      } catch {
        return { list: [], total: 0 };
      }
    },
    staleTime: 1000 * 60 * 10,
  });

  const users = usersQuery.data?.list || [];

  // 2. Fetch KPI Summary with Jalali period & user filter
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<DashboardSummary>({
    queryKey: [...queryKeys.dashboard.summary(), jalaliPeriod, assignedUserId],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (jalaliPeriod) params.jalaliPeriod = jalaliPeriod;
      if (assignedUserId) params.assignedUserId = assignedUserId;
      return apiClient.get<DashboardSummary>('/BidarDashboard/summary', { params });
    },
  });

  // 3. Fetch Real Pending Activities
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
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />

        {/* KPI Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 sm:h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
            />
          ))}
        </div>

        {/* Lower Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
          <div className="h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMsg =
      error instanceof Error ? error.message : 'خطا در دریافت اطلاعات داشبورد از سرور.';

    return (
      <div
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center text-rose-700 dark:text-rose-300 max-w-xl mx-auto my-12"
        dir="rtl"
      >
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-800 dark:text-rose-200 mb-2">
          خطا در دریافت اطلاعات داشبورد
        </h3>
        <p className="text-xs text-rose-600/80 dark:text-rose-300/80 mb-6 leading-relaxed">
          {errorMsg}
        </p>
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

  const summary: DashboardSummary = data || {
    openCount: 0,
    openAmount: 0,
    wonCount: 0,
    wonAmount: 0,
    rottenCount: 0,
    overdueActivitiesCount: 0,
    conversionRate: 0,
    avgSalesCycleDays: 0,
    funnelStages: [],
    lossReasonsBreakdown: [],
    topSalesReps: [],
    leadSourceBreakdown: [],
  };

  const pendingActivities: PendingActivityItem[] = (activitiesData?.list || []).map((t) => ({
    id: t.id,
    name: t.name,
    type: (t as any).type || ('Task' as const),
    dateDue: t.dateEnd || t.dateDue,
    status: t.status,
    priority: t.priority,
  }));

  const goalTarget = summary.goal?.targetValue ?? 100000000;
  const goalCurrent = summary.goal?.currentValue ?? summary.wonAmount ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8" dir="rtl">
      {/* Page Header & Period / User Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            پیشخوان فروش بیدار
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            خلاصه عملکرد کاریز معاملات، درآمد تحقق‌یافته و رصد لحظه‌ای اقدامات
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Jalali Period Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
            {JALALI_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setJalaliPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold ${
                  jalaliPeriod === p.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sales Rep User Filter Dropdown */}
          <div className="relative">
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              className="pl-3 pr-8 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="">همه کارشناسان</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.userName}
                </option>
              ))}
            </select>
            <User className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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

      {/* GAP-03: Secondary Efficiency Metrics & GAP-07: Sales Goal Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Conversion Rate Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">نرخ تبدیل فروش</span>
            <div className="text-xl font-bold text-teal-600 dark:text-teal-400 font-sans tabular-nums" dir="rtl">
              {toPersianDigits(summary.conversionRate ?? 0)}٪
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">نسبت معاملات موفق به کل بسته شده</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* Avg Sales Cycle Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">سرعت فروش (میانگین چرخه)</span>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-sans tabular-nums" dir="rtl">
              {toPersianDigits(summary.avgSalesCycleDays ?? 0)} روز
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">فاصله ایجاد تا نهایی‌شدن معامله</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Timer className="w-5 h-5" />
          </div>
        </div>

        {/* GAP-07: Sales Goal Widget bound to summary.goal */}
        <div className="lg:col-span-1">
          <SalesGoalWidget
            goalName={summary.goal?.name || 'هدف فروش ماهانه'}
            targetAmount={goalTarget}
            currentAmount={goalCurrent}
          />
        </div>
      </div>

      {/* Middle Analytical Section: Funnel & Loss Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Funnel Chart (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <SalesFunnelChart stages={summary.funnelStages} />

          {/* GAP-03: Loss Reasons Breakdown */}
          <LossReasonsWidget reasons={summary.lossReasonsBreakdown} />
        </div>

        {/* Daily Priority Activities (1 Col) */}
        <div>
          <PendingActivitiesWidget activities={pendingActivities} onNavigate={onNavigate} />
        </div>
      </div>

      {/* Lower Section: Top Sales Reps & Lead Sources Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sales Reps Leaderboard */}
        <TopSalesRepsWidget reps={summary.topSalesReps as any} />

        {/* Lead Acquisition Sources Breakdown */}
        <LeadSourcesWidget sources={summary.leadSourceBreakdown as any} />
      </div>
    </div>
  );
};

export default DashboardPage;
