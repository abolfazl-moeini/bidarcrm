/**
 * BidarCRM - Root Application Entry Component
 *
 * Directs traffic based on active session authentication state:
 * - Displays LoginPage when unauthenticated
 * - Mounts AppShell workspace when authenticated
 */

import React from 'react';
import { useAuth } from './features/auth/hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/layout/AppShell';

export default function App(): React.JSX.Element {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-sm backdrop-blur-sm">
        <h2 className="text-xl font-bold text-slate-100 mb-2">پیشخوان مدیریت فروش بیدار</h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
          سامانه یکپارچه مدیریت فرآیند فروش، کاریزهای چندگانه، رصد معاملات و فعالیت‌های روزمره تیم فروش.
        </p>
      </div>
    </AppShell>
  );
}
