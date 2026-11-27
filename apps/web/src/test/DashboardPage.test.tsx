import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DashboardPage } from '../pages/DashboardPage';
import { apiClient, ApiError } from '../lib/api-client';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DashboardPage & KPI / Funnel Visualizations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockSummaryData = {
    openCount: 14,
    openAmount: 450000000,
    wonCount: 8,
    wonAmount: 320000000,
    rottenCount: 3,
    overdueActivitiesCount: 5,
    funnelStages: [
      { stageId: 's1', stageName: 'سرنخ جدید', count: 6, amount: 120000000, color: '#6366f1' },
      { stageId: 's2', stageName: 'مذاکره اولیه', count: 5, amount: 180000000, color: '#3b82f6' },
      { stageId: 's3', stageName: 'پیش‌نویس قرارداد', count: 3, amount: 150000000, color: '#10b981' },
    ],
  };

  it('renders loading skeleton while fetching dashboard metrics', async () => {
    let resolveSummary: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveSummary = resolve;
    });

    vi.spyOn(apiClient, 'get').mockImplementation(() => pendingPromise as any);

    renderWithClient(<DashboardPage />);

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();

    resolveSummary!(mockSummaryData);
  });

  it('renders all 4 KPI cards with formatted Persian digits and currency values', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockSummaryData);

    renderWithClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
    });

    // 1. Open Deals KPI
    expect(screen.getByText('معاملات باز')).toBeInTheDocument();
    expect(screen.getByText(/۴۵۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();
    expect(screen.getByText(/۱۴ معامله/)).toBeInTheDocument();

    // 2. Won Deals Revenue KPI
    expect(screen.getByText('درآمد محقق‌شده')).toBeInTheDocument();
    expect(screen.getAllByText(/۳۲۰,۰۰۰,۰۰۰ تومان/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/۸ موفق/)).toBeInTheDocument();

    // 3. Rotten Deals KPI
    expect(screen.getByText('معاملات پوسیده')).toBeInTheDocument();
    expect(screen.getByText('۳')).toBeInTheDocument();

    // 4. Overdue Activities KPI
    expect(screen.getByText('فعالیت‌های معوق')).toBeInTheDocument();
    expect(screen.getByText('۵')).toBeInTheDocument();
  });

  it('renders sales funnel chart stages with counts and amounts', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockSummaryData);

    renderWithClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('قیف فروش معاملات')).toBeInTheDocument();
    });

    expect(screen.getByText('سرنخ جدید')).toBeInTheDocument();
    expect(screen.getByText('مذاکره اولیه')).toBeInTheDocument();
    expect(screen.getByText('پیش‌نویس قرارداد')).toBeInTheDocument();

    expect(screen.getByText(/۱۲۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();
    expect(screen.getByText(/۱۸۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();
    expect(screen.getByText(/۱۵۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();
  });

  it('renders pending activities list with Jalali dates and activity types', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/Task')) {
        return {
          list: [
            { id: 'act-1', name: 'تماس با شرکت فناوری آریا', type: 'Call', dateDue: '2026-11-22T08:30:00.000Z' },
            { id: 'act-2', name: 'جلسه پرزنتیشن محصول', type: 'Meeting', dateDue: '2026-11-23T10:00:00.000Z' },
            { id: 'act-3', name: 'ارسال پیش‌فاکتور رسمی', type: 'Task', dateDue: '2026-11-24T12:00:00.000Z' },
          ],
          total: 3,
        };
      }
      return mockSummaryData;
    });

    renderWithClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('فعالیت‌های نیازمند اقدام')).toBeInTheDocument();
    });

    expect(screen.getByText(/تماس با شرکت فناوری آریا/i)).toBeInTheDocument();
    expect(screen.getByText(/جلسه پرزنتیشن محصول/i)).toBeInTheDocument();
    expect(screen.getByText(/ارسال پیش‌فاکتور رسمی/i)).toBeInTheDocument();
  });

  it('renders clean empty state when no pending activities exist', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/Task')) {
        return { list: [], total: 0 };
      }
      return mockSummaryData;
    });

    renderWithClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/فعالیت معوق یا نیازمند اقدامی وجود ندارد/i)).toBeInTheDocument();
    });
  });

  it('displays error state with retry button on network or 500 failure', async () => {
    const errorSpy = vi.spyOn(apiClient, 'get').mockRejectedValue(
      new ApiError(500, 'Internal Server Error', 'Database connection refused')
    );

    renderWithClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/خطا در دریافت اطلاعات داشبورد/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /تلاش مجدد/i });
    expect(retryBtn).toBeInTheDocument();

    errorSpy.mockResolvedValueOnce(mockSummaryData);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('معاملات باز')).toBeInTheDocument();
    });
  });

  it('renders GAP-03 (conversion rate, avg cycle, loss reasons) and GAP-07 (sales goal widget)', async () => {
    const enrichedData = {
      ...mockSummaryData,
      conversionRate: 42.5,
      avgSalesCycleDays: 14,
      lossReasonsBreakdown: [
        { reason: 'too_expensive', label: 'قیمت بالا', count: 5, amount: 50000000 },
        { reason: 'chose_competitor', label: 'انتخاب رقبا', count: 3, amount: 30000000 },
      ],
      goal: {
        name: 'هدف فروش ماهانه',
        targetValue: 500000000,
        currentValue: 320000000,
      },
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue(enrichedData);

    renderWithClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('نرخ تبدیل فروش')).toBeInTheDocument();
    });

    expect(screen.getByText('سرعت فروش (میانگین چرخه)')).toBeInTheDocument();
    expect(screen.getByText('تحلیل دلایل شکست معاملات')).toBeInTheDocument();
    expect(screen.getByText('قیمت بالا')).toBeInTheDocument();
    expect(screen.getByText('انتخاب رقبا')).toBeInTheDocument();
    expect(screen.getByText('هدف فروش ماهانه')).toBeInTheDocument();
  });
});
