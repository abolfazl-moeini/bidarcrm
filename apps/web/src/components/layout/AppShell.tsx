/**
 * BidarCRM - AppShell Component
 *
 * Core layout frame with Didar-inspired dark signature header & rail,
 * responsive mobile drawer, pinned shortcuts dropdown (GAP-08), and theme-adaptive canvas.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Menu, Pin, X, Briefcase, User, Building2 } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { GlobalSearchBar } from './GlobalSearchBar';
import { UserNav } from './UserNav';
import { brandNameFa } from '../../lib/brand';
import { PinnedItem, getPinnedItems, removePinnedItem } from '../../lib/pinned';
import { toPersianDigits } from '../../lib/iran-format';

export interface AppShellProps {
  children?: React.ReactNode;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onNewDeal?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentPath = '/dashboard',
  onNavigate,
  onNewDeal,
  onSearch: _onSearch,
  className = '',
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPinnedDropdown, setShowPinnedDropdown] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const pinnedDropdownRef = useRef<HTMLDivElement>(null);

  // Sync pinned items
  useEffect(() => {
    setPinnedItems(getPinnedItems());

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ items: PinnedItem[] }>;
      if (customEvent.detail?.items) {
        setPinnedItems(customEvent.detail.items);
      } else {
        setPinnedItems(getPinnedItems());
      }
    };

    window.addEventListener('bidar:pinned_updated', handleUpdate);
    return () => window.removeEventListener('bidar:pinned_updated', handleUpdate);
  }, []);

  // Click outside to close pinned dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pinnedDropdownRef.current && !pinnedDropdownRef.current.contains(e.target as Node)) {
        setShowPinnedDropdown(false);
      }
    };
    if (showPinnedDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPinnedDropdown]);

  const handlePinnedClick = (item: PinnedItem) => {
    setShowPinnedDropdown(false);
    onNavigate?.(item.url);
  };

  const handleUnpin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removePinnedItem(id);
    setPinnedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const getPinnedIcon = (type: string) => {
    switch (type) {
      case 'deal':
        return <Briefcase className="w-3.5 h-3.5 text-indigo-400" />;
      case 'contact':
        return <User className="w-3.5 h-3.5 text-emerald-400" />;
      case 'account':
        return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Pin className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div
      className={`bidar-app-shell flex h-screen w-screen overflow-hidden bg-slate-900 font-sans antialiased selection:bg-emerald-500 selection:text-white ${className}`}
      dir="rtl"
      lang="fa"
    >
      {/* 1. Primary RTL Sidebar (Right side - Slim Rail with Desktop Expand & Mobile Drawer) */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* 2. Main Work Area (Header + Fluid Responsive Canvas) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar - Dark Didar Signature Topbar */}
        <header className="h-14 bg-slate-900 text-slate-100 border-b border-slate-800/90 px-3 sm:px-6 flex items-center justify-between gap-3 z-30 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-xl">
            {/* Hamburger Button on Mobile/Tablet */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg lg:hidden cursor-pointer"
              aria-label="باز کردن منو"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Workspace Identifier */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-800">
              <span className="text-xs font-semibold text-slate-200">{brandNameFa} CRM</span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm">
                کاریز فعال
              </span>
            </div>

            {/* Global Search Bar */}
            <GlobalSearchBar currentPath={currentPath} onNavigate={onNavigate} />

            {/* Pinned Items Dropdown Trigger */}
            <div className="relative hidden xl:block" ref={pinnedDropdownRef}>
              <button
                type="button"
                onClick={() => setShowPinnedDropdown(!showPinnedDropdown)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                  showPinnedDropdown
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title="موارد پین‌شده"
              >
                <Pin className={`w-3.5 h-3.5 ${pinnedItems.length > 0 ? 'fill-emerald-500/30 text-emerald-400' : ''}`} />
                <span>پین‌شده‌ها</span>
                {pinnedItems.length > 0 && (
                  <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full">
                    {toPersianDigits(pinnedItems.length)}
                  </span>
                )}
              </button>

              {/* Pinned Items Popover Menu */}
              {showPinnedDropdown && (
                <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden transition-opacity duration-100">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                    <span>موارد سنجاق‌شده ({toPersianDigits(pinnedItems.length)})</span>
                    <span className="text-[10px] font-normal text-slate-400">حداکثر ۱۰ مورد</span>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {pinnedItems.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-[11px]">
                        موردی سنجاق نشده است. با زدن علامت سنجاق در صفحات جزئیات، موارد پرکاربرد را اینجا ذخیره کنید.
                      </div>
                    ) : (
                      pinnedItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handlePinnedClick(item)}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getPinnedIcon(item.type)}
                            <div className="min-w-0">
                              <span className="font-medium text-slate-900 dark:text-slate-100 truncate block">
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span className="text-[10px] text-slate-400 truncate block">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleUnpin(e, item.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="حذف از پین‌شده‌ها"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User & Theme Navigation */}
          <UserNav onNewDeal={onNewDeal} onNavigate={onNavigate} />
        </header>

        {/* Dynamic Responsive Workspace Canvas (Light / Dark Adaptive) */}
        <main className="bidar-canvas flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 bg-[#F4F6F8] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 transition-colors duration-150">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
