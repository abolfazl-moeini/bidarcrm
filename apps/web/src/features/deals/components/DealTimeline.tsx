/**
 * BidarCRM - DealTimeline Component
 *
 * Renders an interactive vertical timeline of deal stream events
 * (notes, calls, meetings, tasks) with Shamsi dates and distinct Lucide icons.
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

function getEventIcon(type?: string) {
  switch (type) {
    case 'Call':
      return {
        icon: PhoneCall,
        badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        label: 'تماس تلفنی',
      };
    case 'Meeting':
      return {
        icon: Users,
        badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
        label: 'جلسه حضوری/آنلاین',
      };
    case 'Task':
      return {
        icon: CheckSquare,
        badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        label: 'کار بعدی',
      };
    case 'Note':
      return {
        icon: MessageSquare,
        badgeBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
        label: 'یادداشت',
      };
    default:
      return {
        icon: History,
        badgeBg: 'bg-slate-800 border-slate-700 text-slate-400',
        label: 'رویداد سیستم',
      };
  }
}

export const DealTimeline: React.FC<DealTimelineProps> = ({ notes, className = '' }) => {
  if (notes.length === 0) {
    return (
      <div
        className={`bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs ${className}`}
        dir="rtl"
      >
        <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p>هنوز تعاملی برای این معامله ثبت نشده است.</p>
        <p className="text-[11px] text-slate-600 mt-1">
          از کادر بالا جهت ثبت اولین یادداشت یا تماس استفاده کنید.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 relative ${className}`} dir="rtl">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        تایم‌لاین تعاملات و یادداشت‌ها
      </h3>

      <div className="relative pl-0 pr-4 space-y-6 before:absolute before:right-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {notes.map((note) => {
          const { icon: Icon, badgeBg, label } = getEventIcon(note.type);
          const jalaliDate = note.createdAt ? formatJalaliDate(note.createdAt) : '';

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
              <div className="flex-1 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {note.createdByName || 'کاربر سیستم'}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
                      {label}
                    </span>
                  </div>
                  {jalaliDate && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono" dir="ltr">
                      {jalaliDate}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {note.post}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DealTimeline;
