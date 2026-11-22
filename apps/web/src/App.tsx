/**
 * BidarCRM - Root Application Entry Component
 *
 * Provides global TanStack Query Client context and session-driven routing:
 * - Unauthenticated session: LoginPage
 * - Authenticated session: AppShell supporting Dashboard and Kanban views
 */

import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { useAuth } from './features/auth/hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { KanbanPage } from './pages/KanbanPage';

export function AppContent(): React.JSX.Element {
  const { isAuthenticated } = useAuth();
  const [currentPath, setCurrentPath] = useState('/dashboard');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell currentPath={currentPath} onNavigate={setCurrentPath}>
      {currentPath === '/kanban' ? <KanbanPage /> : <DashboardPage />}
    </AppShell>
  );
}

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
