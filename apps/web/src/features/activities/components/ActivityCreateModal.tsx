/**
 * BidarCRM - ActivityCreateModal Component
 *
 * Popup dialog to schedule a new task, phone call, or meeting with
 * priority, due date, and associated customer/deal context.
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

export interface ActivityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (created: Task) => void;
  initialData?: Partial<Task & { type?: 'Task' | 'Call' | 'Meeting' }>;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('عنوان فعالیت الزامی است');
      return;
    }

    try {
      setIsSubmitting(true);
      const isoDate = dateDue || new Date().toISOString();
      let created: Task;

      if (type === 'Call') {
        created = await apiClient.post<Task>('/Call', {
          name: name.trim(),
          type: 'Call',
          status: 'Planned',
          direction: 'Outbound',
          dateStart: isoDate,
          dateDue: isoDate,
          description: description.trim() || undefined,
          parentId: initialData?.parentId,
          parentType: initialData?.parentType,
          accountName: initialData?.accountName,
          contactName: initialData?.contactName,
        });
      } else if (type === 'Meeting') {
        created = await apiClient.post<Task>('/Meeting', {
          name: name.trim(),
          type: 'Meeting',
          status: 'Planned',
          dateStart: isoDate,
          dateDue: isoDate,
          description: description.trim() || undefined,
          parentId: initialData?.parentId,
          parentType: initialData?.parentType,
          accountName: initialData?.accountName,
          contactName: initialData?.contactName,
        });
      } else {
        // type === 'Task'
        created = await apiClient.post<Task>('/Task', {
          name: name.trim(),
          type: 'Task',
          priority,
          status: 'Not Started',
          dateEnd: isoDate,
          dateDue: isoDate,
          description: description.trim() || undefined,
          parentId: initialData?.parentId,
          parentType: initialData?.parentType,
          accountName: initialData?.accountName,
          contactName: initialData?.contactName,
        });
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h3 id="activity-modal-title" className="text-sm font-bold text-slate-100">ثبت فعالیت جدید</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity Type Selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">نوع فعالیت</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('Task')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  type === 'Task'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>وظیفه</span>
              </button>

              <button
                type="button"
                onClick={() => setType('Call')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  type === 'Call'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>تماس</span>
              </button>

              <button
                type="button"
                onClick={() => setType('Meeting')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  type === 'Meeting'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>جلسه</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              عنوان فعالیت <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="عنوان کار یا فعالیت را وارد کنید..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition"
            />
          </div>

          {/* Priority & Date Due */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">اولویت</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition"
              >
                <option value="Normal">عادی</option>
                <option value="High">بالا</option>
                <option value="Urgent">فوری</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">سررسید</label>
              <input
                type="date"
                value={dateDue ? dateDue.slice(0, 10) : ''}
                onChange={(e) => setDateDue(e.target.value ? `${e.target.value}T12:00:00.000Z` : '')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">توضیحات اختیاری</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="جزئیات بیشتر..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
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
