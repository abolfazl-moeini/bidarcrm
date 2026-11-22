/**
 * BidarCRM - Sidebar Navigation Component
 *
 * Implements accessible, right-aligned RTL navigation with Clean-Room IP,
 * Lucide icons, and role-gated admin portal access.
 */

import React from 'react';
import {
  LayoutDashboard,
  Columns3,
  Users,
  Building2,
  CalendarCheck,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../features/auth/hooks/useAuth';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'داشبورد',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'kanban',
    label: 'کاریز معاملات',
    href: '/kanban',
    icon: Columns3,
  },
  {
    id: 'contacts',
    label: 'مخاطبان',
    href: '/contacts',
    icon: Users,
  },
  {
    id: 'accounts',
    label: 'شرکت‌ها',
    href: '/accounts',
    icon: Building2,
  },
  {
    id: 'activities',
    label: 'فعالیت‌ها و تقویم',
    href: '/activities',
    icon: CalendarCheck,
  },
];

export interface SidebarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath = '/dashboard',
  onNavigate,
  className = '',
}) => {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <aside
      className={`w-64 bg-slate-900/95 border-l border-slate-800 flex flex-col justify-between select-none z-20 ${className}`}
      dir="rtl"
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/30">
            ب
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base text-slate-100 tracking-tight">بیدار CRM</span>
            <span className="text-[11px] text-slate-500 font-normal">مدیریت هوشمند فروش</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="p-4 space-y-1.5" aria-label="ناوبری اصلی">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.href ||
              (item.href === '/kanban' && currentPath === '/deals') ||
              (item.href === '/kanban' && currentPath.startsWith('/deals/')) ||
              (item.href === '/activities' && currentPath === '/calendar');

            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  if (onNavigate) {
                    e.preventDefault();
                    onNavigate(item.href);
                  }
                }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Admin Panel Gateway (Role-gated) */}
      <div className="p-4 border-t border-slate-800/80">
        {isAdmin && (
          <a
            href="/admin"
            target="_self"
            rel="noreferrer"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-amber-400/90 hover:text-amber-300 hover:bg-amber-400/10 border border-amber-500/20 transition duration-150"
            aria-label="تنظیمات سیستم"
          >
            <Shield className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span>تنظیمات سیستم</span>
          </a>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
