/**
 * BidarCRM - PendingActivitiesWidget Component
 *
 * Displays prioritized pending activities with Shamsi Jalali dates,
 * activity type badges, empty state, light/dark adaptive styling, and SPA navigation.
 */

import React from 'react';
import { Clock, PhoneCall, Users, CheckSquare, ChevronLeft } from 'lucide-react';
import { formatJalaliDate } from '../../../lib/jalali';

export interface PendingActivityItem {
  id: string;
  name: string;
  type?: 'Call' | 'Meeting' | 'Task';
  dateDue?: string;
  dateStart?: string;
  dateEnd?: string;
  status?: string;
  priority?: string;
}

export interface PendingActivitiesWidgetProps {
  activities?: PendingActivityItem[];
  onNavigate?: (path: string) => void;
  className?: string;
}

const TYPE_CONFIG = {
  Call: {
    label: 'تماس',
    icon: PhoneCall,
    color: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
  },
  Meeting: {
    label: 'جلسه',
    icon: Users,
    color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  },
  Task: {
    label: 'وظیفه',
    icon: CheckSquare,
    color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  },
};

export const PendingActivitiesWidget: React.FC<PendingActivitiesWidgetProps> = ({
  activities = [],
  onNavigate,
  className = '',
}) => {
  const handleViewAll = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/activities');
    } else if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/activities');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between ${className}`}
      dir="rtl"
    >
      <div>
        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">فعالیت‌های نیازمند اقدام</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">تماس‌ها، جلسات و وظایف دارای موعد نزدیک</p>
            </div>
          </div>
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-1 rounded-lg">
            {activities.length} مورد
          </span>
        </div>

        <div className="space-y-2.5">
          {activities.length === 0 ? (
            <div className="h-36 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                فعالیت معوق یا نیازمند اقدامی وجود ندارد. همه چیز به‌روز است!
              </p>
            </div>
          ) : (
            activities.slice(0, 5).map((act) => {
              const type = act.type || 'Task';
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.Task;
              const Icon = cfg.icon;
              const dateRaw = act.dateDue || act.dateStart;
              const formattedDate = dateRaw ? formatJalaliDate(dateRaw) : 'بدون موعد';

              return (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition duration-150"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${cfg.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{cfg.label}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {act.name}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex-shrink-0">
                    {formattedDate}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <a
          href="/activities"
          onClick={handleViewAll}
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
        >
          <span>مشاهده همه فعالیت‌ها و تقویم</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};

export default PendingActivitiesWidget;
