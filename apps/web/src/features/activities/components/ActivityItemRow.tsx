/**
 * BidarCRM - ActivityItemRow Component
 *
 * Renders an interactive activity/task row:
 * - Quick completion checkbox with optimistic state
 * - CRM core workflow prompt ("تعریف کار بعدی") upon completion
 * - Activity type badge (Call, Meeting, Task)
 * - Due date (Jalali) and priority indicator
 * - Light and dark mode adaptive styling
 */

import React from 'react';
import {
  PhoneCall,
  Users,
  CheckSquare,
  Building2,
  Calendar,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';
import { Task } from '../../../types/espocrm';
import { formatJalaliDate } from '../../../lib/jalali';

export interface ActivityItemRowProps {
  activity: Task & { type?: 'Task' | 'Call' | 'Meeting'; dateStart?: string };
  onToggleComplete?: (activityId: string, completed: boolean) => void;
  onScheduleNext?: (activity: Task) => void;
  className?: string;
}

export const ActivityItemRow: React.FC<ActivityItemRowProps> = ({
  activity,
  onToggleComplete,
  onScheduleNext,
  className = '',
}) => {
  const isCompleted = activity.status === 'Completed' || (activity.status as string) === 'Held';

  const getTypeInfo = (type?: string) => {
    switch (type) {
      case 'Call':
        return {
          icon: PhoneCall,
          label: 'تماس',
          color: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
        };
      case 'Meeting':
        return {
          icon: Users,
          label: 'جلسه',
          color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        };
      default:
        return {
          icon: CheckSquare,
          label: 'وظیفه',
          color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
        };
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'Urgent':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-[10px] font-medium whitespace-nowrap inline-flex items-center shrink-0 gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>فوری</span>
          </span>
        );
      case 'High':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-[10px] font-medium whitespace-nowrap inline-flex items-center shrink-0">
            بالا
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] whitespace-nowrap inline-flex items-center shrink-0">
            عادی
          </span>
        );
    }
  };

  const { icon: TypeIcon, label: typeLabel, color: typeColor } = getTypeInfo(activity.type);
  const rawDate = activity.type === 'Task'
    ? (activity.dateEnd || activity.dateDue)
    : (activity.dateStart || activity.dateDue || activity.dateEnd);
  const jalaliDate = rawDate ? formatJalaliDate(rawDate) : null;
  const customerLabel = activity.accountName || activity.contactName || activity.parentName;

  return (
    <div
      data-testid={`activity-row-${activity.id}`}
      className={`bidar-activity-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100/90 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700/80 rounded-xl transition duration-150 shadow-sm ${
        isCompleted ? 'opacity-65 bg-slate-100/40 dark:bg-slate-950/40' : ''
      } ${className}`}
      dir="rtl"
    >
      {/* Right (RTL): Checkbox & Activity Info */}
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        {/* Quick Complete Checkbox */}
        <label className="flex items-center cursor-pointer pt-0.5 sm:pt-0">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(e) => onToggleComplete?.(activity.id, e.target.checked)}
            className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 transition cursor-pointer"
          />
        </label>

        {/* Activity Type Badge */}
        <span
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium whitespace-nowrap shrink-0 ${typeColor}`}
        >
          <TypeIcon className="w-3.5 h-3.5" />
          <span>{typeLabel}</span>
        </span>

        {/* Details: Title & Associated Entity */}
        <div className="flex-1 min-w-0">
          <h4
            className={`text-xs font-semibold text-slate-900 dark:text-slate-100 truncate ${
              isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : ''
            }`}
          >
            {activity.name}
          </h4>

          {customerLabel && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              <Building2 className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              <span className="truncate">{customerLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Left (RTL): Due Date, Priority & Next Action */}
      <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
        {jalaliDate && (
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-sans tabular-nums font-mono" dir="ltr">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>{jalaliDate}</span>
          </div>
        )}

        {getPriorityBadge(activity.priority)}

        {/* Core CRM workflow prompt: Next Followup Button */}
        {isCompleted && (
          <button
            type="button"
            onClick={() => onScheduleNext?.(activity)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium transition cursor-pointer"
            title="ثبت پیگیری و کار بعدی برای این مشتری"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>تعریف کار بعدی</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ActivityItemRow;
