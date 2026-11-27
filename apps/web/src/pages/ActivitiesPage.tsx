/**
 * BidarCRM - ActivitiesPage Component
 *
 * Full activities, tasks, calls, and meetings hub with Didar-inspired operations bar,
 * 3 view modes:
 *  1. Filterable List View
 *  2. Monthly Jalali Calendar Grid with Iranian holidays (IR-11)
 *  3. Task Kanban Board with 3 status columns (GAP-10)
 * Optimistic completion with follow-up prompt ("ثبت نتیجه و تنظیم پیگیری بعدی"),
 * and light/dark mode adaptation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  ListFilter,
  Calendar as CalendarIcon,
  Columns3,
  Plus,
  RefreshCw,
  Search,
  X,
  AlertCircle,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { Task, TaskStatus, EspoListResponse } from '../types/espocrm';
import { toPersianDigits } from '../lib/currency';
import { ActivityItemRow } from '../features/activities/components/ActivityItemRow';
import { JalaliCalendarView } from '../features/activities/components/JalaliCalendarView';
import { ActivityCreateModal } from '../features/activities/components/ActivityCreateModal';
import { TaskKanbanBoard } from '../features/activities/components/TaskKanbanBoard';

export type ActivityFilterTab = 'all' | 'today' | 'overdue' | 'tomorrow';
export type ActivityViewMode = 'list' | 'calendar' | 'kanban';

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
  const [viewMode, setViewMode] = useState<ActivityViewMode>('list');
  const [filterTab, setFilterTab] = useState<ActivityFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<Partial<UnifiedActivity> | undefined>(
    undefined
  );
  const [localActivities, setLocalActivities] = useState<UnifiedActivity[]>([]);

  // Completion Prompt State: "ثبت نتیجه و تنظیم پیگیری بعدی"
  const [completedPromptItem, setCompletedPromptItem] = useState<UnifiedActivity | null>(null);

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
        type: 'Task' as const,
        _endpoint: 'Task' as const,
      }));

      let callList: UnifiedActivity[] = [];
      try {
        const callsRes = await apiClient.get<EspoListResponse<any>>('/Call?maxSize=100');
        callList = (callsRes?.list || [])
          .filter((c: any) => !taskList.some((t) => t.id === c.id))
          .map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status === 'Held' ? 'Completed' : 'Not Started',
            dateEnd: c.dateEnd || c.dateStartDate || c.dateStart,
            dateStart: c.dateStart || c.dateStartDate,
            priority: 'Normal',
            accountName: c.accountName,
            contactName: c.contactName,
            parentId: c.parentId,
            parentType: c.parentType,
            type: 'Call' as const,
            _endpoint: 'Call' as const,
          }));
      } catch {
        // Soft fallback
      }

      let meetingList: UnifiedActivity[] = [];
      try {
        const meetingsRes = await apiClient.get<EspoListResponse<any>>('/Meeting?maxSize=100');
        meetingList = (meetingsRes?.list || [])
          .filter((m: any) => !taskList.some((t) => t.id === m.id) && !callList.some((c) => c.id === m.id))
          .map((m) => ({
            id: m.id,
            name: m.name,
            status: m.status === 'Held' ? 'Completed' : 'Not Started',
            dateEnd: m.dateEnd || m.dateStartDate || m.dateStart,
            dateStart: m.dateStart || m.dateStartDate,
            priority: 'Normal',
            accountName: m.accountName,
            contactName: m.contactName,
            parentId: m.parentId,
            parentType: m.parentType,
            type: 'Meeting' as const,
            _endpoint: 'Meeting' as const,
          }));
      } catch {
        // Soft fallback
      }

      return [...taskList, ...callList, ...meetingList];
    },
  });

  useEffect(() => {
    if (data) {
      setLocalActivities(data);
    }
  }, [data]);

  const handleToggleComplete = async (activityId: string, completed: boolean) => {
    const previousSnapshot = [...localActivities];
    const newStatus = completed ? 'Completed' : 'Not Started';

    const targetActivity = localActivities.find((act) => act.id === activityId);

    setLocalActivities((prev) =>
      prev.map((act) => (act.id === activityId ? { ...act, status: newStatus } : act))
    );

    // If marked completed, trigger follow-up prompt
    if (completed && targetActivity) {
      setCompletedPromptItem(targetActivity);
    }

    try {
      if (targetActivity?._endpoint === 'Call') {
        await apiClient.patch(`/Call/${activityId}`, {
          status: completed ? 'Held' : 'Planned',
        });
      } else if (targetActivity?._endpoint === 'Meeting') {
        await apiClient.patch(`/Meeting/${activityId}`, {
          status: completed ? 'Held' : 'Planned',
        });
      } else {
        await apiClient.patch(`/Task/${activityId}`, {
          status: newStatus,
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch {
      setLocalActivities(previousSnapshot);
    }
  };

  const handleUpdateTaskKanbanStatus = async (taskId: string, newStatus: TaskStatus) => {
    const previous = [...localActivities];
    setLocalActivities((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const target = localActivities.find((t) => t.id === taskId);
    if (newStatus === 'Completed' && target) {
      setCompletedPromptItem(target);
    }

    try {
      await apiClient.patch(`/Task/${taskId}`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    } catch {
      setLocalActivities(previous);
    }
  };

  const handleScheduleNext = (activity: UnifiedActivity) => {
    setModalInitialData({
      name: `پیگیری: ${activity.name}`,
      parentId: activity.parentId,
      parentType: activity.parentType,
      type: 'Task',
    });
    setCompletedPromptItem(null);
    setIsModalOpen(true);
  };

  const handleModalSuccess = (created?: UnifiedActivity) => {
    if (created && created.id) {
      setLocalActivities((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    let result = [...localActivities];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.accountName?.toLowerCase().includes(q) ||
          a.contactName?.toLowerCase().includes(q)
      );
    }

    const todayStr = getTehranDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getTehranDateString(tomorrow);

    switch (filterTab) {
      case 'today':
        result = result.filter((a) => {
          const actDate = a.dateEnd || a.dateDue;
          if (!actDate) return false;
          return getTehranDateString(new Date(actDate)) === todayStr;
        });
        break;
      case 'overdue':
        result = result.filter((a) => {
          if (a.status === 'Completed') return false;
          const actDate = a.dateEnd || a.dateDue;
          if (!actDate) return false;
          return getTehranDateString(new Date(actDate)) < todayStr;
        });
        break;
      case 'tomorrow':
        result = result.filter((a) => {
          const actDate = a.dateEnd || a.dateDue;
          if (!actDate) return false;
          return getTehranDateString(new Date(actDate)) === tomorrowStr;
        });
        break;
      default:
        break;
    }

    return result;
  }, [localActivities, filterTab, searchQuery]);

  return (
    <div className="space-y-4 sm:space-y-5 flex flex-col h-full" dir="rtl">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                فعالیت‌ها و تقویم
              </h1>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
                {toPersianDigits(localActivities.length)} برنامه
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مدیریت وظایف، تماس‌ها، جلسات و برنامه‌ریزی تقویم
            </p>
          </div>
        </div>

        {/* 3 View Mode Tabs & Primary CTA */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Segmented 3-Way Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>لیست</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>تقویم شمسی</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>کانبان کارها</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer"
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
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت فعالیت</span>
          </button>
        </div>
      </div>

      {/* Completion Follow-Up Prompt Banner */}
      {completedPromptItem && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition-opacity">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                فعالیت «{completedPromptItem.name}» تکمیل شد.
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                ثبت نتیجه و تنظیم پیگیری بعدی برای تضمین چرخه فروش پیشنهاد می‌شود.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCompletedPromptItem(null)}
              className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              بستن
            </button>
            <button
              type="button"
              onClick={() => handleScheduleNext(completedPromptItem)}
              className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-sm transition cursor-pointer"
            >
              <span>تنظیم پیگیری بعدی</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar for List View */}
      {viewMode === 'list' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'همه' },
              { id: 'today', label: 'امروز' },
              { id: 'overdue', label: 'معوقه' },
              { id: 'tomorrow', label: 'فردا' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id as ActivityFilterTab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  filterTab === tab.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در فعالیت‌ها..."
              className="w-full pr-9 pl-8 py-1.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 transition outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-0.5 cursor-pointer"
                title="پاک کردن جستجو"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{error instanceof Error ? error.message : 'خطا در بارگذاری فعالیت‌ها'}</span>
        </div>
      )}

      {/* Main Content Area based on View Mode */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex-1">
          {filteredActivities.length === 0 && !isLoading ? (
            <div className="h-44 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                هیچ فعالیتی با فیلتر انتخابی یافت نشد.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredActivities.map((act) => (
                <ActivityItemRow
                  key={act.id}
                  activity={act}
                  onToggleComplete={handleToggleComplete}
                  onScheduleNext={handleScheduleNext}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="flex-1">
          <JalaliCalendarView
            activities={localActivities}
            onSelectDate={(date) => {
              setModalInitialData({ dateEnd: date });
              setIsModalOpen(true);
            }}
          />
        </div>
      )}

      {viewMode === 'kanban' && (
        <div className="flex-1">
          <TaskKanbanBoard
            tasks={localActivities.filter((a) => a._endpoint === 'Task' || a.type === 'Task')}
            onUpdateStatus={handleUpdateTaskKanbanStatus}
            onSelectTask={(task) => {
              setModalInitialData(task);
              setIsModalOpen(true);
            }}
          />
        </div>
      )}

      {/* Quick Activity Creation Dialog */}
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
