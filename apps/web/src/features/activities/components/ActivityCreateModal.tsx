/**
 * BidarCRM - ActivityCreateModal Component
 *
 * Popup dialog to schedule a new task, phone call, or meeting with
 * priority, due date, customer/deal context, and light/dark mode adaptation.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckSquare,
  PhoneCall,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Task, TaskPriority } from '../../../types/espocrm';
import { formatJalaliDate } from '../../../lib/jalali';
import { authStore } from '../../auth/authStore';

export const formatEspoDateTime = (input: Date | string, defaultHour = 10, defaultMinute = 0): string => {
  let date: Date;
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
      const [year, month, day] = input.trim().split('-').map(Number);
      date = new Date(Date.UTC(year, month - 1, day, defaultHour, defaultMinute, 0));
    } else {
      date = new Date(input);
    }
  } else {
    date = input;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

export interface ActivityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (created: Task) => void;
  initialData?: Partial<Task & { type?: 'Task' | 'Call' | 'Meeting'; assignedUserId?: string }>;
}

export const ActivityCreateModal: React.FC<ActivityCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<'Task' | 'Call' | 'Meeting'>('Task');
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [dateDue, setDateDue] = useState(initialData?.dateDue || '');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setType(initialData?.type || 'Task');
      setPriority(initialData?.priority || 'Normal');
      setDateDue(
        initialData?.dateDue ||
          initialData?.dateEnd ||
          (initialData as any)?.dateStart ||
          ''
      );
      setDescription(initialData?.description || '');
      setError(null);
    } else {
      setName('');
      setType('Task');
      setPriority('Normal');
      setDateDue('');
      setDescription('');
      setError(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('عنوان فعالیت الزامی است.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const assignedUserId =
      initialData?.assignedUserId ||
      authStore.getState().user?.id ||
      '2b45fd50209e2a898';

    try {
      let created: Task;
      if (type === 'Call') {
        const startStr = dateDue
          ? formatEspoDateTime(dateDue, 10, 0)
          : formatEspoDateTime(new Date());
        const endStr = dateDue
          ? formatEspoDateTime(dateDue, 10, 15)
          : formatEspoDateTime(new Date(Date.now() + 15 * 60 * 1000));

        const res = await apiClient.post<any>('/Call', {
          name: name.trim(),
          status: 'Planned',
          direction: 'Outbound',
          dateStart: startStr,
          dateEnd: endStr,
          assignedUserId,
          description: description.trim() || undefined,
          parentId: initialData?.parentId,
          parentType: initialData?.parentType,
          accountName: initialData?.accountName,
          contactName: initialData?.contactName,
        });
        created = {
          ...res,
          type: 'Call',
          status: 'Not Started',
          dateStart: res.dateStart || startStr,
          dateEnd: res.dateEnd || endStr,
          priority: 'Normal',
        };
      } else if (type === 'Meeting') {
        const startStr = dateDue
          ? formatEspoDateTime(dateDue, 10, 0)
          : formatEspoDateTime(new Date());
        const endStr = dateDue
          ? formatEspoDateTime(dateDue, 11, 0)
          : formatEspoDateTime(new Date(Date.now() + 60 * 60 * 1000));

        const res = await apiClient.post<any>('/Meeting', {
          name: name.trim(),
          status: 'Planned',
          dateStart: startStr,
          dateEnd: endStr,
          assignedUserId,
          description: description.trim() || undefined,
          parentId: initialData?.parentId,
          parentType: initialData?.parentType,
          accountName: initialData?.accountName,
          contactName: initialData?.contactName,
        });
        created = {
          ...res,
          type: 'Meeting',
          status: 'Not Started',
          dateStart: res.dateStart || startStr,
          dateEnd: res.dateEnd || endStr,
          priority: 'Normal',
        };
      } else {
        const dueStr = dateDue
          ? formatEspoDateTime(dateDue, 12, 0)
          : formatEspoDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000));

        const res = await apiClient.post<Task>('/Task', {
          name: name.trim(),
          type: 'Task',
          priority,
          status: 'Not Started',
          dateEnd: dueStr,
          assignedUserId,
          description: description.trim() || undefined,
          parentId: initialData?.parentId,
          parentType: initialData?.parentType,
          accountName: initialData?.accountName,
          contactName: initialData?.contactName,
        });
        created = {
          ...res,
          type: 'Task',
          status: res.status || 'Not Started',
          dateEnd: res.dateEnd || dueStr,
          priority: res.priority || priority,
        };
      }

      onSuccess?.(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت فعالیت جدید');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-modal-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h3 id="activity-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ثبت فعالیت جدید
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity Type Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">نوع فعالیت</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('Task')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  type === 'Task'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>وظیفه</span>
              </button>

              <button
                type="button"
                onClick={() => setType('Call')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  type === 'Call'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>تماس</span>
              </button>

              <button
                type="button"
                onClick={() => setType('Meeting')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  type === 'Meeting'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>جلسه</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              عنوان فعالیت <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="عنوان کار یا فعالیت را وارد کنید..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition"
            />
          </div>

          {/* Due Date & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">تاریخ موعد</label>
              <input
                type="date"
                value={dateDue}
                onChange={(e) => setDateDue(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none transition"
              />
              {dateDue && (
                <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium" dir="rtl">
                  {formatJalaliDate(dateDue)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">اولویت</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none transition"
              >
                <option value="Low">پایین</option>
                <option value="Normal">عادی</option>
                <option value="High">بالا</option>
                <option value="Urgent">فوری</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">توضیحات</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نکات تکمیلی برای انجام کار..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>ثبت فعالیت</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityCreateModal;
