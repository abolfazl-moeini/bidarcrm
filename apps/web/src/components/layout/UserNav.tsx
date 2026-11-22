/**
 * BidarCRM - UserNav Component
 *
 * User profile indicator, quick creation action, and session logout trigger.
 */

import React from 'react';
import { Plus, LogOut } from 'lucide-react';
import { useAuth } from '../../features/auth/hooks/useAuth';

export interface UserNavProps {
  onNewDeal?: () => void;
  className?: string;
}

export const UserNav: React.FC<UserNavProps> = ({ onNewDeal, className = '' }) => {
  const { user, logout } = useAuth();

  const displayName = user?.name || user?.userName || 'کاربر سامانه';
  const initial = displayName.trim().charAt(0) || 'ب';

  return (
    <div className={`flex items-center gap-3 ${className}`} dir="rtl">
      {/* Quick Create CTA */}
      <button
        type="button"
        onClick={onNewDeal}
        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-sm transition duration-150 cursor-pointer"
        aria-label="معامله جدید"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>معامله جدید</span>
      </button>

      {/* User Identity Chip */}
      <div className="flex items-center gap-2.5 px-3 py-1 bg-slate-900/60 border border-slate-800 rounded-xl">
        <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs select-none">
          {initial}
        </div>
        <div className="flex flex-col text-right">
          <span className="text-xs font-medium text-slate-200 leading-tight">{displayName}</span>
          <span className="text-[10px] text-slate-500 leading-tight">
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
