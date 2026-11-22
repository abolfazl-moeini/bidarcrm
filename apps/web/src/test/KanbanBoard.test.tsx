import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { KanbanPage } from '../pages/KanbanPage';
import { apiClient, ApiError } from '../lib/api-client';
import { Opportunity, PipelineStage } from '../types/espocrm';

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

describe('KanbanBoard Component & Deal Drag-and-Drop Operations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockStages: PipelineStage[] = [
    { id: 'stage-1', name: 'سرنخ جدید', order: 1, color: '#6366f1' },
    { id: 'stage-2', name: 'مذاکره اولیه', order: 2, color: '#3b82f6' },
    { id: 'stage-3', name: 'پیش‌نویس قرارداد', order: 3, color: '#10b981' },
  ];

  const mockDeals: Opportunity[] = [
    {
      id: 'deal-1',
      name: 'فروش تجهیزات شبکه',
      amount: 35000000,
      pipelineStageId: 'stage-1',
      stage: 'سرنخ جدید',
      accountName: 'شرکت فناوران آریا',
      contactName: 'رضا کمالی',
      lastActivityAt: '2026-11-20T10:00:00.000Z',
      daysSinceLastActivity: 2,
    },
    {
      id: 'deal-2',
      name: 'تمدید پشتیبانی سالانه',
      amount: 50000000,
      pipelineStageId: 'stage-2',
      stage: 'مذاکره اولیه',
      accountName: 'بیمه سلامت',
      contactName: 'مریم حسینی',
      lastActivityAt: '2026-11-21T14:30:00.000Z',
      daysSinceLastActivity: 1,
    },
  ];

  it('renders stages columns with count badges and aggregated amount values', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('Pipeline')) {
        return { list: [{ id: 'pipe-1', name: 'فروش اصلی', stages: mockStages }] };
      }
      return { list: mockDeals, total: 2 };
    });

    renderWithClient(<KanbanPage />);

    await waitFor(() => {
      expect(screen.getByText('سرنخ جدید')).toBeInTheDocument();
      expect(screen.getByText('مذاکره اولیه')).toBeInTheDocument();
      expect(screen.getByText('پیش‌نویس قرارداد')).toBeInTheDocument();
    });

    // Check deal amounts formatted in Tomans
    expect(screen.getAllByText(/۳۵,۰۰۰,۰۰۰ تومان/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/۵۰,۰۰۰,۰۰۰ تومان/).length).toBeGreaterThan(0);

    // Check stage summary headers
    const stage1Column = screen.getByTestId('kanban-column-stage-1');
    expect(stage1Column).toHaveTextContent('۱ معامله');

    const stage2Column = screen.getByTestId('kanban-column-stage-2');
    expect(stage2Column).toHaveTextContent('۱ معامله');

    const stage3Column = screen.getByTestId('kanban-column-stage-3');
    expect(stage3Column).toHaveTextContent('۰ معامله');
  });

  it('renders deal cards with customer and financial information', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('Pipeline')) {
        return { list: [{ id: 'pipe-1', name: 'فروش اصلی', stages: mockStages }] };
      }
      return { list: mockDeals, total: 2 };
    });

    renderWithClient(<KanbanPage />);

    await waitFor(() => {
      expect(screen.getByText('فروش تجهیزات شبکه')).toBeInTheDocument();
    });

    expect(screen.getByText('شرکت فناوران آریا')).toBeInTheDocument();
    expect(screen.getByText('تمدید پشتیبانی سالانه')).toBeInTheDocument();
    expect(screen.getByText('بیمه سلامت')).toBeInTheDocument();
  });

  it('optimistically moves deal from stage-1 to stage-2 and sends PATCH request', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('Pipeline')) {
        return { list: [{ id: 'pipe-1', name: 'فروش اصلی', stages: mockStages }] };
      }
      return { list: mockDeals, total: 2 };
    });

    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
      id: 'deal-1',
      pipelineStageId: 'stage-2',
      stage: 'مذاکره اولیه',
    });

    renderWithClient(<KanbanPage />);

    await waitFor(() => {
      expect(screen.getByTestId('deal-card-deal-1')).toBeInTheDocument();
    });

    const dealCard = screen.getByTestId('deal-card-deal-1');
    const targetColumn = screen.getByTestId('kanban-column-stage-2');

    // Simulate drag and drop
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(k: string, v: string) {
        this.data[k] = v;
      },
      getData(k: string) {
        return this.data[k] || '';
      },
      types: ['text/plain'],
    };

    fireEvent.dragStart(dealCard, { dataTransfer });
    fireEvent.dragOver(targetColumn, { dataTransfer });
    fireEvent.drop(targetColumn, { dataTransfer });

    // Assert optimistic movement: stage-2 now has 2 deals, stage-1 has 0
    await waitFor(() => {
      expect(screen.getByTestId('kanban-column-stage-2')).toHaveTextContent('۲ معامله');
      expect(screen.getByTestId('kanban-column-stage-1')).toHaveTextContent('۰ معامله');
    });

    // Assert PATCH call
    expect(patchSpy).toHaveBeenCalledWith('/Opportunity/deal-1', {
      pipelineStageId: 'stage-2',
      stage: 'مذاکره اولیه',
    });
  });

  it('rolls back optimistic move when PATCH request fails with server error', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('Pipeline')) {
        return { list: [{ id: 'pipe-1', name: 'فروش اصلی', stages: mockStages }] };
      }
      return { list: mockDeals, total: 2 };
    });

    vi.spyOn(apiClient, 'patch').mockRejectedValue(
      new ApiError(500, 'Internal Server Error', 'Database write error')
    );

    renderWithClient(<KanbanPage />);

    await waitFor(() => {
      expect(screen.getByTestId('deal-card-deal-1')).toBeInTheDocument();
    });

    const dealCard = screen.getByTestId('deal-card-deal-1');
    const targetColumn = screen.getByTestId('kanban-column-stage-2');

    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(k: string, v: string) {
        this.data[k] = v;
      },
      getData(k: string) {
        return this.data[k] || '';
      },
      types: ['text/plain'],
    };

    fireEvent.dragStart(dealCard, { dataTransfer });
    fireEvent.dragOver(targetColumn, { dataTransfer });
    fireEvent.drop(targetColumn, { dataTransfer });

    // Should rollback after rejection
    await waitFor(() => {
      expect(screen.getByTestId('kanban-column-stage-1')).toHaveTextContent('۱ معامله');
      expect(screen.getByTestId('kanban-column-stage-2')).toHaveTextContent('۱ معامله');
      expect(screen.getByText(/خطا در انتقال معامله/i)).toBeInTheDocument();
    });
  });
});
