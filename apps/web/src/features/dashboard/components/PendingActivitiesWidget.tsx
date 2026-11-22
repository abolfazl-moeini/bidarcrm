/**
 * BidarCRM - PendingActivitiesWidget Component
 *
 * Displays prioritized pending activities with Shamsi Jalali dates,
 * activity type badges, empty state, and SPA navigation to /activities.
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
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  Meeting: {
    label: 'جلسه',
    icon: Users,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  Task: {
    label: 'وظیفه',
    icon: CheckSquare,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
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
      className={`bg-slate-900/85 border border-slate-800/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between ${className}`}
      dir="rtl"
    >
      <div>
        <div className="flex items-center justify-between mb-6 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">فعالیت‌های نیازمند اقدام</h3>
              <p className="text-[11px] text-slate-500">برنامه‌های کاری و پیگیری‌های نزدیک</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleViewAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition cursor-pointer"
            aria-label="مشاهده همه فعالیت‌ها"
          >
            <span>مشاهده همه</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((item) => {
              const itemType = (item.type as 'Call' | 'Meeting' | 'Task') || 'Task';
              const config = TYPE_CONFIG[itemType] || TYPE_CONFIG.Task;
              const Icon = config.icon;
              const dueDate = item.dateEnd || item.dateStart || item.dateDue;
              const jalaliDate = dueDate ? formatJalaliDate(dueDate) : 'امروز';

              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${config.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{jalaliDate}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-md border flex-shrink-0 ${config.color}`}
                  >
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-800/20 border border-dashed border-slate-800 rounded-xl">
            فعالیت معوق یا نیازمند اقدامی وجود ندارد.
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingActivitiesWidget;
