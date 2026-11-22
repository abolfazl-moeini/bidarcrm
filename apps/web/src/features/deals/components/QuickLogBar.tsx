/**
 * BidarCRM - QuickLogBar Component
 *
 * Streamlined quick-logger for notes, calls, meetings, and follow-up tasks
 * with tab selection, non-empty validation, and instant state feedback.
 */

import React, { useState } from 'react';
import { MessageSquare, PhoneCall, Users, CheckSquare, Send, Loader2 } from 'lucide-react';

export type LogType = 'Note' | 'Call' | 'Meeting' | 'Task';

export interface QuickLogBarProps {
  onSubmit: (post: string, type: LogType) => Promise<void> | void;
  isLoading?: boolean;
  className?: string;
}

const LOG_TABS: { type: LogType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { type: 'Note', label: 'یادداشت', icon: MessageSquare },
  { type: 'Call', label: 'تماس تلفنی', icon: PhoneCall },
  { type: 'Meeting', label: 'جلسه', icon: Users },
  { type: 'Task', label: 'کار بعدی', icon: CheckSquare },
];

export const QuickLogBar: React.FC<QuickLogBarProps> = ({
  onSubmit,
  isLoading = false,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<LogType>('Note');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSubmitting || isLoading) return;

    try {
      setIsSubmitting(true);
      await onSubmit(trimmed, activeTab);
      setText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlaceholder = (type: LogType) => {
    switch (type) {
      case 'Call':
        return 'نتیجه تماس تلفنی یا خلاصه مکالمه با مخاطب را بنویسید...';
      case 'Meeting':
        return 'خلاصه صورت‌جلسه یا تصمیمات اتخاذ شده را یادداشت کنید...';
      case 'Task':
        return 'عنوان و جزئیات کار یا پیگیری بعدی را وارد نمایید...';
      default:
        return 'یادداشت جدید یا نتیجه فعالیت را بنویسید...';
    }
  };

  const isButtonDisabled = !text.trim() || isSubmitting || isLoading;

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 ${className}`}
      dir="rtl"
    >
      {/* Activity Type Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {LOG_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.type;
          return (
            <button
              key={tab.type}
              type="button"
              onClick={() => setActiveTab(tab.type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex-shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Input Area and Submit Action */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={getPlaceholder(activeTab)}
          className="w-full p-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 resize-none outline-none transition"
        />

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isButtonDisabled}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            {isSubmitting || isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 rotate-180" />
            )}
            <span>ثبت یادداشت / فعالیت</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuickLogBar;
