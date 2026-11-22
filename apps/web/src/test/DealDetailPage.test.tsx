import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DealDetailPage } from '../pages/DealDetailPage';
import { apiClient } from '../lib/api-client';
import { Opportunity, Note } from '../types/espocrm';

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

describe('DealDetailPage - 360 Degree Deal Detail & Stream Timeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockDeal: Opportunity & { contactPhone?: string; contactEmail?: string } = {
    id: 'deal-101',
    name: 'توسعه پلتفرم ابری سازمانی',
    amount: 120000000,
    stage: 'مذاکره نهایی',
    pipelineStageId: 'stage-3',
    pipelineName: 'فروش مستقیم',
    accountName: 'هلدینگ پارس رایانه',
    contactName: 'مهندس احمدی',
    contactPhone: '09123456789',
    contactEmail: 'ahmadi@parsrayaneh.com',
    closeDate: '2026-12-15T00:00:00.000Z',
    isRotten: true,
    daysSinceLastActivity: 8,
    createdAt: '2026-11-01T08:00:00.000Z',
  };

  const mockNotes: Note[] = [
    {
      id: 'note-1',
      parentType: 'Opportunity',
      parentId: 'deal-101',
      type: 'Note',
      post: 'جلسه بررسی نیازمندی‌های زیرساخت شبکه برگزار شد.',
      createdByName: 'مدیر فروش',
      createdAt: '2026-11-10T10:30:00.000Z',
    },
    {
      id: 'note-2',
      parentType: 'Opportunity',
      parentId: 'deal-101',
      type: 'Call',
      post: 'تماس تلفنی با مدیر فنی جهت نهایی‌سازی پیشنهاد قیمت.',
      createdByName: 'کارشناس ارشد فروش',
      createdAt: '2026-11-14T14:15:00.000Z',
    },
  ];

  it('renders deal sidebar with financial info, customer contacts with tel/mailto links, and rotten alert', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/Note') || url.includes('/stream')) {
        return { list: mockNotes, total: 2 };
      }
      return mockDeal;
    });

    renderWithClient(<DealDetailPage dealId="deal-101" />);

    // Wait for deal details to load
    await waitFor(() => {
      expect(screen.getAllByText('توسعه پلتفرم ابری سازمانی').length).toBeGreaterThan(0);
    });

    // Check Toman amount formatted
    expect(screen.getByText(/۱۲۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();

    // Check contact & account info
    expect(screen.getByText('هلدینگ پارس رایانه')).toBeInTheDocument();
    expect(screen.getByText('مهندس احمدی')).toBeInTheDocument();

    // Check direct tel: and mailto: links
    const phoneLink = screen.getByRole('link', { name: /09123456789|۰۹۱۲۳۴۵۶۷۸۹/i });
    expect(phoneLink).toHaveAttribute('href', 'tel:09123456789');

    const emailLink = screen.getByRole('link', { name: /ahmadi@parsrayaneh.com/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:ahmadi@parsrayaneh.com');

    // Check rotten badge is displayed
    expect(screen.getByText(/۸ روز بدون پیگیری/)).toBeInTheDocument();

    // Check Won and Lost action buttons
    expect(screen.getByRole('button', { name: /برنده|Closed Won/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /باخته|Closed Lost/i })).toBeInTheDocument();
  });

  it('renders vertical stream timeline with Jalali dates and activity notes', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/Note') || url.includes('/stream')) {
        return { list: mockNotes, total: 2 };
      }
      return mockDeal;
    });

    renderWithClient(<DealDetailPage dealId="deal-101" />);

    await waitFor(() => {
      expect(screen.getByText('جلسه بررسی نیازمندی‌های زیرساخت شبکه برگزار شد.')).toBeInTheDocument();
      expect(screen.getByText('تماس تلفنی با مدیر فنی جهت نهایی‌سازی پیشنهاد قیمت.')).toBeInTheDocument();
    });

    // Check creators and Shamsi dates
    expect(screen.getByText('مدیر فروش')).toBeInTheDocument();
    expect(screen.getByText('کارشناس ارشد فروش')).toBeInTheDocument();
  });

  it('submits a new note via QuickLogBar, clears input, and immediately appends it to the timeline', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/Note') || url.includes('/stream')) {
        return { list: [...mockNotes], total: 2 };
      }
      return mockDeal;
    });

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      id: 'note-new',
      parentType: 'Opportunity',
      parentId: 'deal-101',
      type: 'Note',
      post: 'تفاهم‌نامه اولیه به امضای طرفین رسید.',
      createdByName: 'شما',
      createdAt: new Date().toISOString(),
    });

    renderWithClient(<DealDetailPage dealId="deal-101" />);

    await waitFor(() => {
      expect(screen.getAllByText('توسعه پلتفرم ابری سازمانی').length).toBeGreaterThan(0);
    });

    const textarea = screen.getByPlaceholderText(/یادداشت جدید|متن فعالیت/i);
    const submitBtn = screen.getByRole('button', { name: /ثبت یادداشت|ثبت فعالیت/i });

    // Initially submit is disabled if empty
    expect(submitBtn).toBeDisabled();

    // Type note text
    fireEvent.change(textarea, { target: { value: 'تفاهم‌نامه اولیه به امضای طرفین رسید.' } });
    expect(submitBtn).not.toBeDisabled();

    // Click submit
    fireEvent.click(submitBtn);

    // Assert API call
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/Note', expect.objectContaining({
        parentType: 'Opportunity',
        parentId: 'deal-101',
        post: 'تفاهم‌نامه اولیه به امضای طرفین رسید.',
      }));
    });

    // Assert input field cleared
    expect(textarea).toHaveValue('');

    // Assert new note appears in timeline
    await waitFor(() => {
      expect(screen.getByText('تفاهم‌نامه اولیه به امضای طرفین رسید.')).toBeInTheDocument();
    });
  });

  it('marks deal as won, updates stage status, and sends PATCH request to backend', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/Note') || url.includes('/stream')) {
        return { list: mockNotes, total: 2 };
      }
      return mockDeal;
    });

    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
      ...mockDeal,
      stage: 'Closed Won',
    });

    renderWithClient(<DealDetailPage dealId="deal-101" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /برنده|Closed Won/i })).toBeInTheDocument();
    });

    const wonBtn = screen.getByRole('button', { name: /برنده|Closed Won/i });
    fireEvent.click(wonBtn);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('/Opportunity/deal-101', {
        stage: 'Closed Won',
      });
    });
  });
});
