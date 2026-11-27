/**
 * BidarCRM - QuickLogBar Component
 *
 * Streamlined quick-logger for notes, calls, meetings, and follow-up tasks
 * with tab selection, non-empty validation, file attachment, and light/dark mode adaptation.
 */

import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  PhoneCall,
  Users,
  CheckSquare,
  Send,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';

export type LogType = 'Note' | 'Call' | 'Meeting' | 'Task';

export interface QuickLogBarExtra {
  direction?: 'Outbound' | 'Inbound';
  dateStart?: string;
  dateEnd?: string;
  attachmentId?: string;
  attachmentName?: string;
}

export interface QuickLogBarProps {
  onSubmit: (post: string, type: LogType, extra?: QuickLogBarExtra) => Promise<void> | void;
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

  // Extra states for Call, Meeting, Task, Attachment
  const [callDirection, setCallDirection] = useState<'Outbound' | 'Inbound'>('Outbound');
  const [dueDate, setDueDate] = useState<string>('');
  const [meetingStart, setMeetingStart] = useState<string>('');
  const [meetingEnd, setMeetingEnd] = useState<string>('');
  const [attachment, setAttachment] = useState<{ id: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('type', file.type || 'application/octet-stream');

      const res = await apiClient.post<{ id: string; name: string }>('/Attachment', formData);
      if (res?.id) {
        setAttachment({ id: res.id, name: file.name });
      }
    } catch {
      // Fallback
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSubmitting || isLoading) return;

    try {
      setIsSubmitting(true);
      const extra: QuickLogBarExtra = {};

      if (activeTab === 'Call') {
        extra.direction = callDirection;
      } else if (activeTab === 'Meeting') {
        if (meetingStart) extra.dateStart = new Date(meetingStart).toISOString();
        if (meetingEnd) extra.dateEnd = new Date(meetingEnd).toISOString();
      } else if (activeTab === 'Task') {
        if (dueDate) extra.dateEnd = new Date(dueDate).toISOString();
      } else if (activeTab === 'Note' && attachment) {
        extra.attachmentId = attachment.id;
        extra.attachmentName = attachment.name;
      }

      await onSubmit(trimmed, activeTab, extra);
      setText('');
      setAttachment(null);
      setDueDate('');
      setMeetingStart('');
      setMeetingEnd('');
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

  const isButtonDisabled = !text.trim() || isSubmitting || isLoading || isUploading;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 ${className}`}
      dir="rtl"
    >
      {/* Activity Type Selector Tabs */}
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5">
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
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab specific options */}
        {activeTab === 'Call' && (
          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setCallDirection('Outbound')}
              className={`px-2 py-0.5 rounded-lg border transition ${
                callDirection === 'Outbound'
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              خروجی
            </button>
            <button
              type="button"
              onClick={() => setCallDirection('Inbound')}
              className={`px-2 py-0.5 rounded-lg border transition ${
                callDirection === 'Inbound'
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              ورودی
            </button>
          </div>
        )}
      </div>

      {/* Input Area and Submit Action */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={getPlaceholder(activeTab)}
          className="w-full p-3 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none outline-none transition"
        />

        {/* Auxiliary Fields depending on Tab */}
        {activeTab === 'Task' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 text-[11px]">موعد انجام:</span>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>
        )}

        {activeTab === 'Meeting' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 text-[11px]">شروع جلسه:</span>
            <input
              type="datetime-local"
              value={meetingStart}
              onChange={(e) => setMeetingStart(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none"
            />
            <span className="text-slate-500 text-[11px]">پایان:</span>
            <input
              type="datetime-local"
              value={meetingEnd}
              onChange={(e) => setMeetingEnd(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>
        )}

        {/* Note Attachment indicator */}
        {attachment && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 w-fit">
            <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-mono text-[11px]">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-slate-400 hover:text-rose-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {/* Note attachment file picker */}
          {activeTab === 'Note' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs transition cursor-pointer"
                title="پیوست فایل"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5" />
                )}
                <span>پیوست فایل</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={isButtonDisabled}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
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
