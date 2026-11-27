/**
 * BidarCRM - ReportsPage Component
 *
 * Comprehensive sales performance & analytics reporting center:
 * - Conversion Funnel analysis (قیف فروش)
 * - Top Sales Reps Leaderboard (کارشناسان برتر فروش)
 * - Lead Acquisition Sources Breakdown (کانال‌های ورودی سرنخ)
 * - Deal Loss Reasons Analysis (دلایل شکست معاملات)
 * - Sales Velocity & Cycle Time (سرعت فروش و طول چرخه)
 * - Jalali period filters (ماه جاری، ماه گذشته، فصل جاری، سال جاری)
 * - Persian CSV Report Export
 * - Clean Didar styling with dark/light mode adaptation
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { downloadCsvBlob } from '../lib/url';
import { DashboardSummary } from '../types/espocrm';
import { toPersianDigits, formatCurrency } from '../lib/iran-format';
import { SalesFunnelChart } from '../features/dashboard/components/SalesFunnelChart';
import { LossReasonsWidget } from '../features/dashboard/components/LossReasonsWidget';
import { TopSalesRepsWidget } from '../features/dashboard/components/TopSalesRepsWidget';
import { LeadSourcesWidget } from '../features/dashboard/components/LeadSourcesWidget';

const REPORT_PERIODS = [
  { id: 'current_month', label: 'ماه جاری' },
  { id: 'last_month', label: 'ماه گذشته' },
  { id: 'current_quarter', label: 'فصل جاری' },
];

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<string>('current_month');

  const { data, isError, error, refetch, isFetching } = useQuery<DashboardSummary>({
    queryKey: ['reports', 'summary', period],
    queryFn: () => apiClient.get<DashboardSummary>('/BidarDashboard/summary', { params: { jalaliPeriod: period } }),
  });

  const summary = data || {
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

  const handleExportCsv = async () => {
    try {
      await downloadCsvBlob(
        '/BidarExport/Opportunity',
        `opportunities-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
        { params: { period } }
      );
    } catch (err) {
      console.error('Failed to export reports CSV:', err);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              گزارش‌ها و تحلیل فروش
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تحلیل قیف تبدیل، عملکرد کارشناسان، کانال‌های ورودی و نرخ بازدهی کاریز
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Period Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
            {REPORT_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold ${
                  period === p.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
            title="خروجی اکسل و CSV گزارش"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">خروجی CSV</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{error instanceof Error ? error.message : 'خطا در بارگذاری گزارش‌ها'}</span>
        </div>
      )}

      {/* KPI Velocity & Conversion Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Won Revenue */}
        <div className="report-card font-vazirmatn bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-slate-500">درآمد محقق‌شده در بازه</span>
          <div className="kpi-value text-xl font-bold text-emerald-600 dark:text-emerald-400 font-vazirmatn tabular-nums">
            {formatCurrency(summary.wonAmount)}
          </div>
          <span className="text-[11px] text-slate-400">{toPersianDigits(summary.wonCount)} معامله نهایی‌شده</span>
        </div>

        {/* Conversion Rate */}
        <div className="report-card font-vazirmatn bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-slate-500">نرخ تبدیل نهایی فروش</span>
          <div className="kpi-value text-xl font-bold text-teal-600 dark:text-teal-400 font-vazirmatn tabular-nums" dir="rtl">
            {toPersianDigits(summary.conversionRate ?? 0)}٪
          </div>
          <span className="text-[11px] text-slate-400">نسبت برنده به کل بسته شده</span>
        </div>

        {/* Sales Cycle */}
        <div className="report-card font-vazirmatn bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-slate-500">طول میانگین چرخه فروش</span>
          <div className="kpi-value text-xl font-bold text-indigo-600 dark:text-indigo-400 font-vazirmatn tabular-nums" dir="rtl">
            {toPersianDigits(summary.avgSalesCycleDays ?? 0)} روز
          </div>
          <span className="text-[11px] text-slate-400">سرعت تبدیل سرنخ به وجه نقد</span>
        </div>

        {/* Active Pipeline Deals */}
        <div className="report-card font-vazirmatn bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-slate-500">معاملات فعال در کاریز</span>
          <div className="kpi-value text-xl font-bold text-slate-800 dark:text-slate-100 font-vazirmatn tabular-nums">
            {formatCurrency(summary.openAmount)}
          </div>
          <span className="text-[11px] text-slate-400">{toPersianDigits(summary.openCount)} فرصت در جریان</span>
        </div>
      </div>

      {/* Primary Analytics Grid: Funnel & Loss Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SalesFunnelChart stages={summary.funnelStages} />
          <LossReasonsWidget reasons={summary.lossReasonsBreakdown} />
        </div>

        <div className="space-y-6">
          <LeadSourcesWidget sources={summary.leadSourceBreakdown as any} />
        </div>
      </div>

      {/* Top Sales Reps Performance Table */}
      <div>
        <TopSalesRepsWidget reps={summary.topSalesReps as any} />
      </div>
    </div>
  );
};

export default ReportsPage;
