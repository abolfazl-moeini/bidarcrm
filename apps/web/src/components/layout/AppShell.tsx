/**
 * BidarCRM - AppShell Component
 *
 * Core layout frame containing right-aligned RTL sidebar, global search header,
 * user profile controls, and fluid main content area.
 */

import React from 'react';
import { Sidebar } from './Sidebar';
import { GlobalSearchBar } from './GlobalSearchBar';
import { UserNav } from './UserNav';

export interface AppShellProps {
  children?: React.ReactNode;
  currentPath?: string;
  onNewDeal?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentPath = '/dashboard',
  onNewDeal,
  onSearch,
  className = '',
}) => {
  return (
    <div
      className={`bidar-app-shell flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white ${className}`}
      dir="rtl"
      lang="fa"
    >
      {/* 1. Primary RTL Sidebar (Right side) */}
      <Sidebar currentPath={currentPath} />

      {/* 2. Main Work Area (Header + Fluid Content) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-slate-900/80 border-b border-slate-800 px-6 flex items-center justify-between gap-4 backdrop-blur-sm z-10">
          <GlobalSearchBar onSearch={onSearch} />
          <UserNav onNewDeal={onNewDeal} />
        </header>

        {/* Dynamic Main Workspace */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950/60">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
