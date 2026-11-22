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
import { DealDetailPage } from './pages/DealDetailPage';
import { ContactsPage } from './pages/ContactsPage';

export function AppContent(): React.JSX.Element {
  const { isAuthenticated } = useAuth();
  const [currentPath, setCurrentPath] = useState('/dashboard');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    if (currentPath.startsWith('/deals/')) {
      const dealId = currentPath.replace('/deals/', '');
      return <DealDetailPage dealId={dealId} onBack={() => setCurrentPath('/kanban')} />;
    }
    if (currentPath === '/kanban') {
      return <KanbanPage onSelectDeal={(id) => setCurrentPath(`/deals/${id}`)} />;
    }
    if (currentPath === '/contacts') {
      return <ContactsPage />;
    }
    return <DashboardPage />;
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={setCurrentPath}>
      {renderContent()}
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
