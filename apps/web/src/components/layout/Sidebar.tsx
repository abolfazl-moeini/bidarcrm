/**
 * BidarCRM - Slim Icon Rail & Sidebar Navigation Component
 *
 * Implements Didar-inspired right-aligned slim icon rail (56px) with expandable
 * labels, hover tooltips, mobile slide-over drawer, and role-gated admin access.
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Columns3,
  Users,
  Building2,
  CalendarCheck,
  Target,
  BarChart3,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { brandNameFa, taglineFa } from '../../lib/brand';

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
    id: 'leads',
    label: 'سرنخ‌ها',
    href: '/leads',
    icon: Target,
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
  {
    id: 'reports',
    label: 'گزارش‌ها',
    href: '/reports',
    icon: BarChart3,
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    href: '/settings',
    icon: Settings,
  },
];

export interface SidebarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath = '/dashboard',
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
  className = '',
}) => {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  // Desktop rail expansion state
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bidar_sidebar_expanded') === 'true';
    }
    return false;
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('bidar_sidebar_expanded', String(next));
      }
      return next;
    });
  };

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Rail Sidebar */}
      <aside
        className={`bidar-sidebar fixed lg:static top-0 bottom-0 right-0 z-50 flex flex-col justify-between bg-white dark:bg-slate-950 border-r border-l border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 shadow-sm dark:shadow-none transition-all duration-200 select-none ${
          /* Desktop Width */
          isExpanded ? 'lg:w-60' : 'lg:w-16'
        } ${
          /* Mobile Drawer Position */
          mobileOpen ? 'translate-x-0 w-64 shadow-2xl' : 'translate-x-full lg:translate-x-0'
        } ${className}`}
        dir="rtl"
        aria-label="سایدبار ناوبری"
      >
        {/* Top Header / Brand */}
        <div>
          <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-200/80 dark:border-white/[0.08]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-base shadow-sm shadow-emerald-900/30 flex-shrink-0">
                ب
              </div>
              <div
                className={`flex flex-col transition-opacity duration-150 ${
                  isExpanded || mobileOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                }`}
              >
                <span className="font-bold text-sm text-slate-900 dark:text-white whitespace-nowrap">{brandNameFa} CRM</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{taglineFa}</span>
              </div>
            </div>

            {/* Close button on mobile */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 lg:hidden rounded-lg"
              aria-label="بستن منو"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-2 space-y-1" aria-label="ناوبری اصلی">
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
                  onClick={(e) => handleNavClick(e, item.href)}
                  title={!isExpanded && !mobileOpen ? item.label : undefined}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#e0f2fe] text-slate-900 dark:bg-indigo-500/20 dark:text-indigo-300 border border-sky-200/80 dark:border-indigo-400/20 shadow-sm font-semibold'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive
                        ? 'text-sky-700 dark:text-indigo-300'
                        : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                    }`}
                  />
                  <span
                    className={`whitespace-nowrap transition-opacity duration-150 ${
                      isExpanded || mobileOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                    }`}
                  >
                    {item.label}
                  </span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="p-2 space-y-1 border-t border-slate-100 dark:border-slate-800/80">
          {/* Admin Panel Link (Role-gated) */}
          {isAdmin && (
            <a
              href="/admin"
              target="_self"
              rel="noreferrer"
              title={!isExpanded && !mobileOpen ? 'تنظیمات سیستم' : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-400/10 border border-amber-200 dark:border-amber-500/20 transition duration-150 cursor-pointer`}
              aria-label="تنظیمات سیستم"
            >
              <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span
                className={`whitespace-nowrap transition-opacity duration-150 ${
                  isExpanded || mobileOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                }`}
              >
                تنظیمات سیستم
              </span>
            </a>
          )}

          {/* Desktop Rail Expand/Collapse Toggle Button */}
          <button
            type="button"
            onClick={toggleExpanded}
            className="hidden lg:flex w-full items-center justify-center p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition cursor-pointer"
            title={isExpanded ? 'بستن نوار منو' : 'باز کردن نوار منو'}
            aria-label={isExpanded ? 'بستن نوار منو' : 'باز کردن نوار منو'}
          >
            {isExpanded ? (
              <div className="flex items-center gap-2 text-xs w-full px-1">
                <ChevronRight className="w-4 h-4" />
                <span>جمع‌کردن نوار</span>
              </div>
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
