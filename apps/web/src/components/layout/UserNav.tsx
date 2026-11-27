/**
 * BidarCRM - UserNav Component
 *
 * User profile indicator, quick creation action, real notification popover with mark all read,
 * direct settings navigation, theme toggle, and session logout.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  LogOut,
  Bell,
  Settings,
  CheckCheck,
  Loader2,
  X,
} from 'lucide-react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';
import { apiClient } from '../../lib/api-client';
import { EspoNotification, EspoListResponse } from '../../types/espocrm';
import { formatRelativeJalali } from '../../lib/jalali';
import { toPersianDigits } from '../../lib/iran-format';

export interface UserNavProps {
  onNewDeal?: () => void;
  onNavigate?: (path: string) => void;
  className?: string;
}

export const UserNav: React.FC<UserNavProps> = ({
  onNewDeal,
  onNavigate,
  className = '',
}) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [notifications, setNotifications] = useState<EspoNotification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || user?.userName || 'کاربر سامانه';
  const initial = displayName.trim().charAt(0) || 'ب';

  // 1. Fetch Notifications with safe resilient fetch
  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get<EspoListResponse<EspoNotification> | EspoNotification[]>(
        '/Notification?maxSize=10&orderBy=createdAt&order=desc'
      );
      if (Array.isArray(res)) {
        setNotifications(res);
      } else if (res && Array.isArray(res.list)) {
        setNotifications(res.list);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Click outside to close notification popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleMarkAllRead = async () => {
    try {
      setIsMarkingRead(true);
      await apiClient.post('/Notification/action/markAllRead');
      await fetchNotifications();
    } catch {
      // Ignore
    } finally {
      setIsMarkingRead(false);
    }
  };

  const handleNotificationClick = (n: EspoNotification) => {
    setShowNotifications(false);
    if (n.relatedType === 'Opportunity' && n.relatedId) {
      onNavigate?.(`/deals/${n.relatedId}`);
    } else if (n.relatedType === 'Lead' && n.relatedId) {
      onNavigate?.(`/leads`);
    } else if (n.relatedType === 'Task') {
      onNavigate?.(`/activities`);
    }
  };

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`} dir="rtl">
      {/* Quick Create Deal CTA */}
      <button
        type="button"
        onClick={onNewDeal}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-medium rounded-xl shadow-sm transition duration-150 cursor-pointer"
        aria-label="معامله جدید"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">معامله جدید</span>
      </button>

      {/* Notifications trigger with Popover */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded-xl transition duration-150 cursor-pointer"
          title="اعلان‌ها"
          aria-label="اعلان‌ها"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-emerald-500 text-white rounded-full text-[10px] font-bold font-mono">
              {toPersianDigits(unreadCount)}
            </span>
          )}
        </button>

        {/* Notifications Popover */}
        {showNotifications && (
          <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden transition-opacity duration-100">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">اعلان‌ها</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                    {toPersianDigits(unreadCount)} جدید
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={isMarkingRead}
                    className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline px-2 py-1 rounded-lg cursor-pointer"
                  >
                    {isMarkingRead ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5" />
                    )}
                    <span>خوانده شد همه</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Items List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  هیچ اعلانی در حال حاضر وجود ندارد.
                </div>
              ) : (
                notifications.map((n) => {
                  const relativeTime = n.createdAt ? formatRelativeJalali(n.createdAt) : '';
                  const msg =
                    n.message ||
                    (typeof n.data?.message === 'string' ? n.data.message : '') ||
                    'رویداد جدید در سامانه ثبت گردید.';
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer ${
                        !n.isRead ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {msg}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                        <span>{relativeTime}</span>
                        {n.relatedType && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                            {n.relatedType}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings Navigation Shortcut */}
      <button
        type="button"
        onClick={() => onNavigate?.('/settings')}
        className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded-xl transition duration-150 cursor-pointer"
        title="تنظیمات سامانه"
        aria-label="تنظیمات سامانه"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Dark / Light Mode Toggle */}
      <ThemeToggle />

      {/* User Identity Chip */}
      <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-800/60 border border-slate-700/60 rounded-xl">
        <div className="w-7 h-7 rounded-lg bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs select-none">
          {initial}
        </div>
        <div className="hidden md:flex flex-col text-right">
          <span className="text-xs font-medium text-slate-200 leading-tight">{displayName}</span>
          <span className="text-[10px] text-slate-400 leading-tight">
            {user?.isAdmin ? 'مدیر سیستم' : 'کارشناس فروش'}
          </span>
        </div>
      </div>

      {/* Logout Action */}
      <button
        type="button"
        onClick={() => logout()}
        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition duration-150 cursor-pointer"
        title="خروج از حساب"
        aria-label="خروج از حساب"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UserNav;
