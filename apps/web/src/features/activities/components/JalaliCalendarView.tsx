/**
 * BidarCRM - JalaliCalendarView Component
 *
 * Full monthly Jalali (Shamsi) calendar grid:
 * - Persian weekdays (شنبه تا جمعه)
 * - Month navigation (Prev/Next) with month/year banner
 * - Today highlight
 * - Day cells with activity counts and interactive inspection
 */

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Task } from '../../../types/espocrm';
import {
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAYS,
  getJalaliParts,
  jalaliToGregorian,
  getJalaliMonthLength,
} from '../../../lib/jalali';
import { toPersianDigits } from '../../../lib/currency';

export interface JalaliCalendarViewProps {
  activities: (Task & { type?: 'Task' | 'Call' | 'Meeting' })[];
  onSelectDate?: (dateStr: string) => void;
  onSelectActivity?: (activityId: string) => void;
  className?: string;
}

export const JalaliCalendarView: React.FC<JalaliCalendarViewProps> = ({
  activities,
  onSelectDate,
  onSelectActivity,
  className = '',
}) => {
  const todayParts = useMemo(() => getJalaliParts(), []);
  const [currentYear, setCurrentYear] = useState(todayParts.year);
  const [currentMonth, setCurrentMonth] = useState(todayParts.month); // 1 to 12

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const daysInCurrentMonth = useMemo(
    () => getJalaliMonthLength(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // First day offset (0: شنبه, 1: یکشنبه, ..., 6: جمعه)
  const firstDayOffset = useMemo(() => {
    const [gy, gm, gd] = jalaliToGregorian(currentYear, currentMonth, 1);
    const gDate = new Date(Date.UTC(gy, gm - 1, gd));
    const gDay = gDate.getUTCDay();
    return (gDay + 1) % 7;
  }, [currentYear, currentMonth]);

  // Map activities by day of this Jalali month
  const activitiesByDay = useMemo(() => {
    const map = new Map<number, (Task & { type?: 'Task' | 'Call' | 'Meeting' })[]>();
    activities.forEach((act) => {
      if (!act.dateDue) return;
      const parts = getJalaliParts(new Date(act.dateDue));
      if (parts.year === currentYear && parts.month === currentMonth) {
        const list = map.get(parts.day) || [];
        list.push(act);
        map.set(parts.day, list);
      }
    });
    return map;
  }, [activities, currentYear, currentMonth]);

  const monthName = PERSIAN_MONTH_NAMES[currentMonth - 1] || '';

  return (
    <div
      className={`bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm ${className}`}
      dir="rtl"
    >
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {monthName} {toPersianDigits(currentYear)}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">تقویم پیگیری‌ها و برنامه‌ریزی فروش</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="ماه قبل"
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="ماه قبل"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentYear(todayParts.year);
              setCurrentMonth(todayParts.month);
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl border border-slate-800 transition cursor-pointer"
          >
            امروز
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="ماه بعد"
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="ماه بعد"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels Header */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 border-b border-slate-800/60 pb-2">
        {PERSIAN_WEEKDAYS.map((wd) => (
          <div key={wd} className="py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Monthly Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Leading Empty Cells */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-20 rounded-xl bg-slate-950/20 border border-transparent" />
        ))}

        {/* Days of the Month */}
        {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
          const day = i + 1;
          const isToday =
            todayParts.year === currentYear &&
            todayParts.month === currentMonth &&
            todayParts.day === day;

          const dayActivities = activitiesByDay.get(day) || [];
          const hasActivities = dayActivities.length > 0;

          return (
            <div
              key={day}
              onClick={() => onSelectDate?.(`${currentYear}/${currentMonth}/${day}`)}
              className={`min-h-20 p-2 rounded-xl border flex flex-col justify-between transition cursor-pointer ${
                isToday
                  ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300 shadow-sm'
                  : hasActivities
                  ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/30 border-slate-800/50 hover:border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold font-mono ${
                    isToday ? 'text-indigo-400' : 'text-slate-300'
                  }`}
                >
                  {toPersianDigits(day)}
                </span>
                {hasActivities && (
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                    {toPersianDigits(dayActivities.length)}
                  </span>
                )}
              </div>

              {/* Activity Preview Chips */}
              <div className="space-y-1 mt-1 overflow-hidden">
                {dayActivities.slice(0, 2).map((act) => (
                  <div
                    key={act.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectActivity?.(act.id);
                    }}
                    className="truncate text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 hover:text-indigo-300 transition"
                    title={act.name}
                  >
                    {act.name}
                  </div>
                ))}
                {dayActivities.length > 2 && (
                  <span className="text-[9px] text-slate-400 block text-left" dir="ltr">
                    +{toPersianDigits(dayActivities.length - 2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JalaliCalendarView;
