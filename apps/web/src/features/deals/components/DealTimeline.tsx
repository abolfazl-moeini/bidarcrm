/**
 * BidarCRM - DealTimeline Component
 *
 * Renders an interactive vertical timeline of deal stream events
 * (notes, calls, meetings, tasks) with Shamsi dates, distinct Lucide icons,
 * and light/dark mode adaptation.
 */

import React from 'react';
import {
  MessageSquare,
  PhoneCall,
  Users,
  CheckSquare,
  History,
  Clock,
} from 'lucide-react';
import { Note } from '../../../types/espocrm';
import { formatJalaliDate } from '../../../lib/jalali';

export interface DealTimelineProps {
  notes: Note[];
  className?: string;
}

function getEventIcon(type?: string, relatedType?: string) {
  const effectiveType = relatedType || type;
  switch (effectiveType) {
    case 'Call':
      return {
        icon: PhoneCall,
        badgeBg: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
        label: 'تماس تلفنی',
      };
    case 'Meeting':
      return {
        icon: Users,
        badgeBg: 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400',
        label: 'جلسه حضوری/آنلاین',
      };
    case 'Task':
      return {
        icon: CheckSquare,
        badgeBg: 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
        label: 'کار بعدی',
      };
    case 'Note':
      return {
        icon: MessageSquare,
        badgeBg: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
        label: 'یادداشت',
      };
    default:
      return {
        icon: History,
        badgeBg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400',
        label: 'رویداد سیستم',
      };
  }
}

export const DealTimeline: React.FC<DealTimelineProps> = ({ notes, className = '' }) => {
  if (notes.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-xs shadow-sm ${className}`}
        dir="rtl"
      >
        <Clock className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
        <p>هنوز تعاملی برای این معامله ثبت نشده است.</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">
          از کادر بالا جهت ثبت اولین یادداشت یا تماس استفاده کنید.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 relative ${className}`} dir="rtl">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        تایم‌لاین تعاملات و یادداشت‌ها
      </h3>

      <div className="relative pl-0 pr-4 space-y-5 before:absolute before:right-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {notes.map((note) => {
          const { icon: Icon, badgeBg, label } = getEventIcon(note.type, note.relatedType);
          const jalaliDate = note.createdAt ? formatJalaliDate(note.createdAt) : '';
          const contentText = note.post || note.relatedName || '';

          return (
            <div key={note.id} className="relative flex items-start gap-3 group">
              {/* Timeline Node Icon */}
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 -mr-2.5 z-10 ${badgeBg}`}
                title={label}
              >
                <Icon className="w-3 h-3" />
              </div>

              {/* Event Content Card */}
              <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 transition shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {note.createdByName || 'کاربر سیستم'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {label}
                    </span>
                  </div>
                  {jalaliDate && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono" dir="ltr">
                      {jalaliDate}
                    </span>
                  )}
                </div>

                {contentText && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {contentText}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DealTimeline;
