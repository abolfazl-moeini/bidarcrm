/**
 * BidarCRM - Root Application Entry Component
 *
 * Implements real URL routing synchronized with browser history (popstate, pushState),
 * supporting base path prefixes (/ and /app), modal triggers, global search, and clean SPA navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { useAuth } from './features/auth/hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { KanbanPage } from './pages/KanbanPage';
import { DealDetailPage } from './pages/DealDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { AccountsPage } from './pages/AccountsPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { DealCreateModal } from './features/kanban/components/DealCreateModal';

export function normalizePath(pathname: string): string {
  if (!pathname) return '/dashboard';
  // Strip /app or /app/ prefix
  let path = pathname.replace(/^\/app(\/|$)/, '/');
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  // Strip query string and hash for route matching
  const qIdx = path.indexOf('?');
  if (qIdx !== -1) {
    path = path.slice(0, qIdx);
  }
  const hIdx = path.indexOf('#');
  if (hIdx !== -1) {
    path = path.slice(0, hIdx);
  }
  // Strip trailing slash unless root
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path || '/dashboard';
}

export function AppContent(): React.JSX.Element {
  const { isAuthenticated, checkAuth } = useAuth();
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);

  // Non-blocking session verification on mount
  useEffect(() => {
    if (isAuthenticated) {
      checkAuth().catch((err) => {
        console.warn('Session verification failed on mount:', err);
      });
    }
  }, []);

  // Initialize path from window.location if available
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location) {
      const normalized = normalizePath(window.location.pathname);
      return normalized === '/' ? '/dashboard' : normalized;
    }
    return '/dashboard';
  });

  // Navigate helper with history pushState and /app prefix awareness
  const navigate = useCallback((targetPath: string) => {
    if (typeof window === 'undefined') {
      setCurrentPath(normalizePath(targetPath));
      return;
    }

    const hasAppPrefix = window.location.pathname.startsWith('/app');
    const prefix = hasAppPrefix ? '/app' : '';
    const cleanTarget = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
    const finalUrl = `${prefix}${cleanTarget}` || '/';

    window.history.pushState(null, '', finalUrl);
    setCurrentPath(normalizePath(targetPath));
  }, []);

  // Listen to browser popstate (Back / Forward)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const normalized = normalizePath(window.location.pathname);
        setCurrentPath(normalized === '/' ? '/dashboard' : normalized);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    // Route matching table:
    // /deals/:id
    if (currentPath.startsWith('/deals/')) {
      const dealId = currentPath.replace('/deals/', '');
      return <DealDetailPage dealId={dealId} onBack={() => navigate('/kanban')} />;
    }

    // /deals or /kanban
    if (currentPath === '/kanban' || currentPath === '/deals') {
      return <KanbanPage onSelectDeal={(id) => navigate(`/deals/${id}`)} />;
    }

    // /contacts
    if (currentPath === '/contacts') {
      return <ContactsPage />;
    }

    // /accounts
    if (currentPath === '/accounts') {
      return <AccountsPage />;
    }

    // /activities or /calendar
    if (currentPath === '/activities' || currentPath === '/calendar') {
      return <ActivitiesPage />;
    }

    // Default: / or /dashboard
    return <DashboardPage onNavigate={navigate} />;
  };

  const handleSearch = (query: string) => {
    if (query && query.trim()) {
      navigate(`/contacts?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <>
      <AppShell
        currentPath={currentPath}
        onNavigate={navigate}
        onNewDeal={() => setIsNewDealModalOpen(true)}
        onSearch={handleSearch}
      >
        {renderContent()}
      </AppShell>

      <DealCreateModal
        isOpen={isNewDealModalOpen}
        onClose={() => setIsNewDealModalOpen(false)}
        onSuccess={(created) => {
          setIsNewDealModalOpen(false);
          if (created?.id) {
            navigate(`/deals/${created.id}`);
          } else {
            navigate('/kanban');
          }
        }}
      />
    </>
  );
}

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
