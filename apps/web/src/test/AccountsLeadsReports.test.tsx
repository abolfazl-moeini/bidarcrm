import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeadsPage } from '../pages/LeadsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { AccountsPage } from '../pages/AccountsPage';
import { apiClient } from '../lib/api-client';
import { safeExternalUrl } from '../lib/url';

const createTestClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

describe('Accounts, Leads & Reports Fixes (A3, B4, C2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('LeadsPage uses apiClient.getBlob instead of window.open for CSV export', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const getBlobSpy = vi
      .spyOn(apiClient, 'getBlob')
      .mockResolvedValue(new Blob(['id,name'], { type: 'text/csv' }));
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [
        {
          id: 'lead-1',
          name: 'مریم رضایی',
          status: 'New',
          source: 'Web Site',
          phoneNumber: '09121234567',
        },
      ],
      total: 1,
    });
    const createObjSpy = vi.fn().mockReturnValue('blob:mock-lead');
    URL.createObjectURL = createObjSpy;
    URL.revokeObjectURL = vi.fn();

    const qc = createTestClient();
    render(
      <QueryClientProvider client={qc}>
        <LeadsPage />
      </QueryClientProvider>
    );

    const exportBtn = await screen.findByRole('button', { name: /خروجی/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(getBlobSpy).toHaveBeenCalledWith('/BidarExport/Lead');
    });
    expect(openSpy).not.toHaveBeenCalled();
    expect(createObjSpy).toHaveBeenCalled();
  });

  it('LeadsPage shows inline error banner instead of window.alert when 1-click convert fails', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [
        {
          id: 'lead-1',
          name: 'مریم رضایی',
          status: 'New',
          source: 'Web Site',
          phoneNumber: '09121234567',
        },
      ],
      total: 1,
    });
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('تبدیل با خطا مواجه شد'));

    const qc = createTestClient();
    render(
      <QueryClientProvider client={qc}>
        <LeadsPage />
      </QueryClientProvider>
    );

    const convertBtn = await screen.findByRole('button', { name: /تبدیل به معامله/i });
    fireEvent.click(convertBtn);

    expect(await screen.findByText('تبدیل با خطا مواجه شد')).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('ReportsPage uses apiClient.getBlob with period param instead of window.open', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const getBlobSpy = vi
      .spyOn(apiClient, 'getBlob')
      .mockResolvedValue(new Blob(['id,name'], { type: 'text/csv' }));
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      openCount: 1,
      openAmount: 1000,
      wonCount: 0,
      wonAmount: 0,
      rottenCount: 0,
      overdueActivitiesCount: 0,
      conversionRate: 0,
      avgSalesCycleDays: 0,
      funnelStages: [],
      lossReasonsBreakdown: [],
      topSalesReps: [],
      leadSourceBreakdown: [],
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-rep');
    URL.revokeObjectURL = vi.fn();

    const qc = createTestClient();
    render(
      <QueryClientProvider client={qc}>
        <ReportsPage />
      </QueryClientProvider>
    );

    const exportBtn = await screen.findByRole('button', { name: /خروجی/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(getBlobSpy).toHaveBeenCalledWith('/BidarExport/Opportunity', {
        params: { period: 'current_month' },
      });
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('AccountsPage wraps group filter bar with flex-wrap and renders safe external URLs', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [
        {
          id: 'acc-1',
          name: 'شرکت امن',
          website: 'javascript:alert(1)',
        },
        {
          id: 'acc-2',
          name: 'شرکت معتبر',
          website: 'example.com',
        },
      ],
      total: 2,
    });

    const qc = createTestClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <AccountsPage />
      </QueryClientProvider>
    );

    await screen.findByText('شرکت امن');
    const filterLabel = screen.getByText('فیلتر گروه:');
    expect(filterLabel.parentElement?.className).toContain('flex-wrap');
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    const validLink = container.querySelector('a[href="https://example.com"]');
    expect(validLink).not.toBeNull();
  });

  it('safeExternalUrl rejects javascript:, data:, control chars, and protocol-relative URLs', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('  java\nscript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeExternalUrl('//evil.com')).toBeNull();
    expect(safeExternalUrl('https://bidarcrm.ir/path')).toBe('https://bidarcrm.ir/path');
    expect(safeExternalUrl('bidarcrm.ir')).toBe('https://bidarcrm.ir');
  });
});
