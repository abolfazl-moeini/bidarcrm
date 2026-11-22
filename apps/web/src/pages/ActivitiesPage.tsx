/**
 * BidarCRM - ActivitiesPage Component
 *
 * Full activities, tasks, calls, and meetings hub:
 * - Dual view: Filterable List View and Monthly Jalali Calendar Grid
 * - Optimistic quick completion with next follow-up workflow prompt
 * - Creation modal for tasks/calls/meetings
 * - Aggregation of Tasks, Calls, and Meetings
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  ListFilter,
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { Task, EspoListResponse } from '../types/espocrm';
import { toPersianDigits } from '../lib/currency';
import { ActivityItemRow } from '../features/activities/components/ActivityItemRow';
import { JalaliCalendarView } from '../features/activities/components/JalaliCalendarView';
import { ActivityCreateModal } from '../features/activities/components/ActivityCreateModal';

export type ActivityFilterTab = 'all' | 'today' | 'overdue' | 'tomorrow';

export type UnifiedActivity = Task & {
  type?: 'Task' | 'Call' | 'Meeting';
  _endpoint?: 'Task' | 'Call' | 'Meeting';
  dateStart?: string;
};

function getTehranDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export const ActivitiesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterTab, setFilterTab] = useState<ActivityFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<Partial<UnifiedActivity> | undefined>(
    undefined
  );
  const [localActivities, setLocalActivities] = useState<UnifiedActivity[]>([]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<UnifiedActivity[]>({
    queryKey: queryKeys.activities.lists(),
    queryFn: async () => {
      const tasksRes = await apiClient.get<EspoListResponse<Task>>('/Task?maxSize=200');
      const taskList: UnifiedActivity[] = (tasksRes?.list || []).map((t) => ({
        ...t,
        _endpoint: 'Task',
        dateDue: t.dateEnd || t.dateDue,
      }));

      try {
        const [callsRes, meetingsRes] = await Promise.all([
          apiClient.get<EspoListResponse<any>>('/Call?maxSize=100').catch(() => null),
          apiClient.get<EspoListResponse<any>>('/Meeting?maxSize=100').catch(() => null),
        ]);

        const calls: UnifiedActivity[] = (callsRes?.list || [])
          .filter((c: any) => !taskList.some((t) => t.id === c.id))
          .map((c: any) => ({
            ...c,
            type: 'Call' as const,
            _endpoint: 'Call' as const,
            dateDue: c.dateStart || c.dateDue || c.dateEnd,
            status:
              c.status === 'Held'
                ? 'Completed'
                : c.status === 'Not Held'
                ? 'Canceled'
                : 'Not Started',
          }));

        const meetings: UnifiedActivity[] = (meetingsRes?.list || [])
          .filter((m: any) => !taskList.some((t) => t.id === m.id))
          .map((m: any) => ({
            ...m,
            type: 'Meeting' as const,
            _endpoint: 'Meeting' as const,
            dateDue: m.dateStart || m.dateDue || m.dateEnd,
            status:
              m.status === 'Held'
                ? 'Completed'
                : m.status === 'Not Held'
                ? 'Canceled'
                : 'Not Started',
          }));

        return [...taskList, ...calls, ...meetings];
      } catch {
        return taskList;
      }
    },
  });

  useEffect(() => {
    if (data) {
      setLocalActivities(data);
    }
  }, [data]);

  // Handle Complete Toggle (Optimistic Update)
  const handleToggleComplete = async (activityId: string, completed: boolean) => {
    const previousSnapshot = [...localActivities];
    const targetActivity = localActivities.find((a) => a.id === activityId);
    const newStatus = completed ? 'Completed' : 'Not Started';

    // Optimistically update
    setLocalActivities((prev) =>
      prev.map((act) => (act.id === activityId ? { ...act, status: newStatus } : act))
    );

    try {
      const endpoint =
        targetActivity?._endpoint ||
        (targetActivity?.type === 'Call' && !activityId.startsWith('task-')
          ? 'Call'
          : targetActivity?.type === 'Meeting' && !activityId.startsWith('task-')
          ? 'Meeting'
          : 'Task');

      if (endpoint === 'Call' || endpoint === 'Meeting') {
        const statusVal = completed ? 'Held' : 'Planned';
        await apiClient.patch(`/${endpoint}/${activityId}`, { status: statusVal });
      } else {
        await apiClient.patch(`/Task/${activityId}`, { status: newStatus });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.activities.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch {
      // Rollback on failure
      setLocalActivities(previousSnapshot);
    }
  };

  // Handle "Schedule Next" prompt
  const handleScheduleNext = (activity: Task) => {
    setModalInitialData({
      name: `پیگیری بعدی - ${activity.name}`,
      accountName: activity.accountName,
      contactName: activity.contactName,
      parentId: activity.parentId,
      parentType: activity.parentType,
    });
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.activities.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    refetch();
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const today = getTehranDateString(now);
    const tomorrow = getTehranDateString(new Date(now.getTime() + 86400000));

    return localActivities.filter((act) => {
      const actDate = act.dateEnd || act.dateStart || act.dateDue;
      const actDateStr = actDate
        ? actDate.includes('T')
          ? getTehranDateString(new Date(actDate))
          : actDate.slice(0, 10)
        : '';

      // 1. Filter by Tab
      if (filterTab === 'today') {
        if (!actDateStr || actDateStr !== today) return false;
      } else if (filterTab === 'overdue') {
        if (act.status === 'Completed' || (act.status as string) === 'Held') return false;
        if (!actDateStr || actDateStr >= today) return false;
      } else if (filterTab === 'tomorrow') {
        if (!actDateStr || actDateStr !== tomorrow) return false;
      }

      // 2. Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = act.name?.toLowerCase().includes(q);
        const matchesCustomer =
          act.accountName?.toLowerCase().includes(q) ||
          act.contactName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCustomer) return false;
      }

      return true;
    });
  }, [localActivities, filterTab, searchQuery]);

  return (
    <div className="space-y-6 flex flex-col h-full" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">فعالیت‌ها و تقویم</h1>
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">
                {toPersianDigits(localActivities.length)} فعالیت
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">مدیریت وظایف، تماس‌ها و جلسات کاری</p>
          </div>
        </div>

        {/* View Switcher & Action Button */}
        <div className="flex items-center gap-2">
          {/* Switcher */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>نمای لیستی</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>تقویم شمسی</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setModalInitialData(undefined);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>فعالیت جدید</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>
              {error instanceof Error ? error.message : 'خطا در بارگذاری فعالیت‌ها'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-rose-400 hover:text-rose-200 font-semibold text-xs"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* View Content */}
      {viewMode === 'list' ? (
        <div className="space-y-4 flex-1">
          {/* Controls: Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                همه
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  filterTab === 'today'
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                کارهای امروز
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('overdue')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  filterTab === 'overdue'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                معوقه / نیازمند اقدام
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('tomorrow')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  filterTab === 'tomorrow'
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                کارهای فردا
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative max-w-xs">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در فعالیت‌ها..."
                className="w-full pr-8 pl-8 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Activity Rows */}
          <div className="space-y-2.5">
            {filteredActivities.map((act) => (
              <ActivityItemRow
                key={act.id}
                activity={act}
                onToggleComplete={handleToggleComplete}
                onScheduleNext={handleScheduleNext}
              />
            ))}

            {filteredActivities.length === 0 && !isLoading && (
              <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
                فعالیتی در این بخش وجود ندارد.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <JalaliCalendarView activities={localActivities} />
        </div>
      )}

      {/* Creation / Follow-up Modal */}
      <ActivityCreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialData={modalInitialData}
      />
    </div>
  );
};

export default ActivitiesPage;
