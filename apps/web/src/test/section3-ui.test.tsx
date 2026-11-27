import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { KanbanColumn } from '../features/kanban/components/KanbanColumn';
import { ContactsTable } from '../features/contacts/components/ContactsTable';
import { LeadsPage } from '../pages/LeadsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { ContactsPage } from '../pages/ContactsPage';
import { authStore } from '../features/auth/authStore';
import { apiClient } from '../lib/api-client';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Section 3 UI Remediation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '1', userName: 'admin', name: 'مدیر', isAdmin: true },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('THM-LIGHT-01 & THM-DARK-01: Sidebar uses light classes in light mode and 3-tier dark contrast', () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside).toHaveClass('border-r', 'border-slate-200', 'text-slate-700');
    expect(aside?.className).toMatch(/bg-(white|slate-50)/);
    expect(aside?.className).toMatch(/dark:bg-(slate-950|\[#0f172a\])/);
  });

  it('THM-BADGE-01: KanbanColumn count badge uses whitespace-nowrap and shrink-0', () => {
    render(
      <KanbanColumn
        stage={{ id: 's1', name: 'واجد شرایط', order: 1, probability: 20, color: '#10B981' }}
        deals={[]}
        onDropDeal={vi.fn()}
      />
    );
    const badge = screen.getByText(/۰ معامله/);
    expect(badge).toHaveClass('whitespace-nowrap', 'shrink-0');
  });

  it('THM-BADGE-01: ContactsTable customer group badges use whitespace-nowrap and shrink-0', () => {
    render(
      <ContactsTable
        contacts={[
          {
            id: 'c1',
            name: 'علی رضایی',
            customerGroups: ['VIP'],
          },
        ]}
      />
    );
    const badge = screen.getByText('ویژه (VIP)');
    expect(badge).toHaveClass('whitespace-nowrap', 'shrink-0');
  });

  it('THM-BADGE-01: LeadsPage status badges and count badge use whitespace-nowrap and shrink-0', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [
        { id: 'l1', name: 'سرنخ تست', status: 'In Process', source: 'Web Site' },
      ],
      total: 1,
    });

    renderWithClient(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('سرنخ تست')).toBeInTheDocument();
    });

    const countBadge = screen.getByText(/۱ سرنخ/);
    expect(countBadge).toHaveClass('whitespace-nowrap', 'shrink-0');

    const statusBadge = screen.getAllByText('در حال پیگیری').find((el) => el.tagName === 'SPAN');
    expect(statusBadge).toHaveClass('whitespace-nowrap', 'shrink-0');
  });

  it('THM-FONT-01: ReportsPage applies font-vazirmatn on KPI cards, kpi-value, th, td and uses Persian digits', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      openCount: 5,
      openAmount: 25000000,
      wonCount: 3,
      wonAmount: 15000000,
      rottenCount: 1,
      overdueActivitiesCount: 0,
      conversionRate: 60,
      avgSalesCycleDays: 12,
      funnelStages: [],
      lossReasonsBreakdown: [],
      topSalesReps: [
        { userId: 'u1', userName: 'سارا احمدی', wonAmount: 15000000, wonCount: 3, openCount: 2, rottenCount: 1 },
      ],
      leadSourceBreakdown: [],
    });

    const { container } = renderWithClient(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('سارا احمدی')).toBeInTheDocument();
    });

    const reportCards = container.querySelectorAll('.report-card');
    expect(reportCards.length).toBeGreaterThanOrEqual(4);
    reportCards.forEach((card) => {
      expect(card).toHaveClass('font-vazirmatn');
    });

    const kpiValues = container.querySelectorAll('.kpi-value');
    expect(kpiValues.length).toBeGreaterThanOrEqual(4);
    kpiValues.forEach((val) => {
      expect(val).toHaveClass('font-vazirmatn');
    });

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((th) => {
      expect(th).toHaveClass('font-vazirmatn');
    });

    const cells = container.querySelectorAll('td');
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((td) => {
      expect(td).toHaveClass('font-vazirmatn');
    });

    expect(screen.getByText(/۶۰٪/)).toBeInTheDocument();
    expect(screen.getByText(/۱۲ روز/)).toBeInTheDocument();
  });

  it('THM-FILTER-01: ContactsPage group filter container wraps and has visible overflow and fit-content min-height', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ list: [], total: 0 });

    renderWithClient(<ContactsPage />);

    await waitFor(() => {
      expect(screen.getByText('فیلتر گروه:')).toBeInTheDocument();
    });

    const filterBar = screen.getByText('فیلتر گروه:').parentElement;
    expect(filterBar).not.toBeNull();
    expect(filterBar).toHaveClass('flex-wrap', 'overflow-visible', 'min-h-fit');
    expect(filterBar?.style.minHeight).toBe('fit-content');
    expect(filterBar?.style.overflow).toBe('visible');
  });
});
