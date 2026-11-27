/**
 * BidarCRM - TaskKanbanBoard Component (GAP-10)
 *
 * Dedicated task and activity Kanban board with 3 status columns:
 * - انجام نشده (Not Started)
 * - در حال انجام (Started)
 * - تکمیل شده (Completed)
 * Supports status progression, quick action triggers, and light/dark mode adaptation.
 */

import React, { useState } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Task, TaskStatus } from '../../../types/espocrm';
import { toPersianDigits } from '../../../lib/iran-format';
import { formatRelativeJalali } from '../../../lib/jalali';

export interface TaskKanbanBoardProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, newStatus: TaskStatus) => void;
  onSelectTask?: (task: Task) => void;
  className?: string;
}

const COLUMNS: { id: TaskStatus; label: string; icon: React.FC<{ className?: string }>; color: string }[] = [
  { id: 'Not Started', label: 'انجام‌نشده', icon: Clock, color: 'border-slate-300 dark:border-slate-700 bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  { id: 'Started', label: 'در حال انجام', icon: Play, color: 'border-amber-400 dark:border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { id: 'Completed', label: 'تکمیل‌شده', icon: CheckCircle2, color: 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
];

export const TaskKanbanBoard: React.FC<TaskKanbanBoardProps> = ({
  tasks,
  onUpdateStatus,
  onSelectTask,
  className = '',
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<TaskStatus | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, colId: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColId: TaskStatus) => {
    e.preventDefault();
    setDragOverColId(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      onUpdateStatus(taskId, targetColId);
    }
    setDraggedTaskId(null);
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-start ${className}`} dir="rtl">
      {COLUMNS.map((col) => {
        const Icon = col.icon;
        const columnTasks = tasks.filter((t) => {
          if (col.id === 'Completed') return t.status === 'Completed';
          if (col.id === 'Started') return t.status === 'Started';
          return t.status !== 'Completed' && t.status !== 'Started';
        });

        const isOver = dragOverColId === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`bg-white dark:bg-slate-900 border ${
              isOver
                ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800'
            } rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col min-h-[450px] transition-all`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg border ${col.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {col.label}
                </h3>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {toPersianDigits(columnTasks.length)}
              </span>
            </div>

            {/* Task Cards Column */}
            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {columnTasks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-100 dark:border-slate-800/80 rounded-xl my-4">
                  کاری در این وضعیت وجود ندارد.
                </div>
              ) : (
                columnTasks.map((task) => {
                  const relativeDate = task.dateEnd || task.dateDue
                    ? formatRelativeJalali(task.dateEnd || task.dateDue)
                    : '';

                  const isDragging = draggedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', task.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedTaskId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverColId(null);
                      }}
                      onClick={() => onSelectTask?.(task)}
                      className={`p-3 bg-slate-50/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-800/80 border ${
                        isDragging
                          ? 'border-dashed border-emerald-500 opacity-50'
                          : 'border-slate-200/80 dark:border-slate-800'
                      } rounded-xl shadow-sm transition group cursor-grab active:cursor-grabbing select-none space-y-2`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                          {task.name}
                        </span>
                        {task.priority && task.priority !== 'Normal' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-rose-500/10 text-rose-600 font-bold">
                            {task.priority === 'Urgent' ? 'فوری' : 'بالا'}
                          </span>
                        )}
                      </div>

                      {/* Parent / Account / Contact */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        {task.accountName && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{task.accountName}</span>
                          </div>
                        )}
                        {task.contactName && (
                          <div className="flex items-center gap-1.5 truncate">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{task.contactName}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer & Status Shift Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-400">
                        {relativeDate ? (
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            <span>{relativeDate}</span>
                          </span>
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-1">
                          {col.id !== 'Not Started' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const prev = col.id === 'Completed' ? 'Started' : 'Not Started';
                                onUpdateStatus(task.id, prev);
                              }}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition text-slate-500"
                              title="انتقال به مرحله قبل"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {col.id !== 'Completed' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = col.id === 'Not Started' ? 'Started' : 'Completed';
                                onUpdateStatus(task.id, next);
                              }}
                              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded transition text-emerald-600 dark:text-emerald-400 font-bold"
                              title="انتقال به مرحله بعد"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TaskKanbanBoard;
