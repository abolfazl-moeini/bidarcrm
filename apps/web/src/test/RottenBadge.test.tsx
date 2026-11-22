import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { RottenBadge } from '../features/kanban/components/RottenBadge';
import { PipelineSelector } from '../features/kanban/components/PipelineSelector';
import { KanbanFilterBar } from '../features/kanban/components/KanbanFilterBar';
import { KanbanPage } from '../pages/KanbanPage';
import { apiClient } from '../lib/api-client';
import { Pipeline, Opportunity, PipelineStage } from '../types/espocrm';

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

describe('Rotten Deals Badges, Pipeline Selector & Filter Bar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockPipelines: Pipeline[] = [
    { id: 'pipe-1', name: 'کاریز فروش مستقیم' },
    { id: 'pipe-2', name: 'کاریز تمدید و پشتیبانی' },
  ];

  const mockStages: PipelineStage[] = [
    { id: 'stage-1', name: 'سرنخ جدید', order: 1, color: '#6366f1' },
    { id: 'stage-2', name: 'مذاکره اولیه', order: 2, color: '#3b82f6' },
  ];

  const mockDeals: Opportunity[] = [
    {
      id: 'deal-active',
      name: 'فروش سرور ابری',
      amount: 15000000,
      pipelineStageId: 'stage-1',
      stage: 'سرنخ جدید',
      accountName: 'داده‌پردازی نوین',
      isRotten: false,
      daysSinceLastActivity: 1,
    },
    {
      id: 'deal-rotten-1',
      name: 'قرارداد توسعه نرم‌افزار',
      amount: 45000000,
      pipelineStageId: 'stage-1',
      stage: 'سرنخ جدید',
      accountName: 'پتروشیمی خلیج',
      isRotten: true,
      daysSinceLastActivity: 12,
    },
    {
      id: 'deal-rotten-2',
      name: 'خرید لایسنس سازمانی',
      amount: 28000000,
      pipelineStageId: 'stage-2',
      stage: 'مذاکره اولیه',
      contactName: 'مهندس رضایی',
      isRotten: true,
      daysSinceLastActivity: 0,
    },
  ];

  describe('RottenBadge Component', () => {
    it('renders with .bidar-rotten-badge and shows Persian stagnant days when daysSinceLastActivity > 0', () => {
      const { container } = render(
        <RottenBadge isRotten={true} daysSinceLastActivity={12} />
      );

      const badge = container.querySelector('.bidar-rotten-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/۱۲ روز بدون پیگیری/);
    });

    it('renders fallback urgent message when isRotten is true but daysSinceLastActivity is 0 or undefined', () => {
      const { container } = render(
        <RottenBadge isRotten={true} />
      );

      const badge = container.querySelector('.bidar-rotten-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/نیازمند اقدام فوری/);
    });

    it('returns null and renders nothing when isRotten is false or undefined', () => {
      const { container } = render(
        <RottenBadge isRotten={false} daysSinceLastActivity={5} />
      );

      expect(container.querySelector('.bidar-rotten-badge')).toBeNull();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('PipelineSelector Component', () => {
    it('renders all pipeline options and triggers onSelectPipeline on change', () => {
      const onSelect = vi.fn();
      render(
        <PipelineSelector
          pipelines={mockPipelines}
          selectedPipelineId="pipe-1"
          onSelectPipeline={onSelect}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByText('کاریز فروش مستقیم')).toBeInTheDocument();
      expect(screen.getByText('کاریز تمدید و پشتیبانی')).toBeInTheDocument();

      fireEvent.change(select, { target: { value: 'pipe-2' } });
      expect(onSelect).toHaveBeenCalledWith('pipe-2');
    });
  });

  describe('KanbanFilterBar Component', () => {
    it('renders search input, toggle button for rotten deals, and triggers callbacks', () => {
      const onToggleRotten = vi.fn();
      const onSearch = vi.fn();
      const onSelectPipeline = vi.fn();

      render(
        <KanbanFilterBar
          pipelines={mockPipelines}
          selectedPipelineId="pipe-1"
          onSelectPipeline={onSelectPipeline}
          onlyRotten={false}
          onToggleOnlyRotten={onToggleRotten}
          searchQuery=""
          onSearchChange={onSearch}
        />
      );

      // Search input test
      const searchInput = screen.getByPlaceholderText(/جستجو در معاملات/i);
      expect(searchInput).toBeInTheDocument();
      fireEvent.change(searchInput, { target: { value: 'پتروشیمی' } });
      expect(onSearch).toHaveBeenCalledWith('پتروشیمی');

      // Rotten toggle button test
      const rottenToggleBtn = screen.getByRole('button', { name: /فقط معاملات راکد|نیازمند اقدام/i });
      expect(rottenToggleBtn).toBeInTheDocument();
      fireEvent.click(rottenToggleBtn);
      expect(onToggleRotten).toHaveBeenCalledTimes(1);
    });
  });

  describe('KanbanPage Integration with Rotten Badges & Filter Bar', () => {
    it('displays rotten badges on deal cards and filters deals when rotten toggle is active', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.includes('Pipeline')) {
          return { list: [{ id: 'pipe-1', name: 'کاریز فروش مستقیم', stages: mockStages }] };
        }
        return { list: mockDeals, total: 3 };
      });

      renderWithClient(<KanbanPage />);

      // Wait for all deals to render
      await waitFor(() => {
        expect(screen.getByText('فروش سرور ابری')).toBeInTheDocument();
        expect(screen.getByText('قرارداد توسعه نرم‌افزار')).toBeInTheDocument();
        expect(screen.getByText('خرید لایسنس سازمانی')).toBeInTheDocument();
      });

      // Verify Rotten Badges exist on rotten deals
      expect(screen.getByText(/۱۲ روز بدون پیگیری/)).toBeInTheDocument();
      expect(screen.getByText(/نیازمند اقدام فوری/)).toBeInTheDocument();

      // Click the rotten deals filter button
      const rottenToggleBtn = screen.getByRole('button', { name: /فقط معاملات راکد|نیازمند اقدام/i });
      fireEvent.click(rottenToggleBtn);

      // Now active deal should be hidden and only rotten deals displayed
      await waitFor(() => {
        expect(screen.queryByText('فروش سرور ابری')).not.toBeInTheDocument();
        expect(screen.getByText('قرارداد توسعه نرم‌افزار')).toBeInTheDocument();
        expect(screen.getByText('خرید لایسنس سازمانی')).toBeInTheDocument();
      });

      // Now filter by search query "پتروشیمی"
      const searchInput = screen.getByPlaceholderText(/جستجو در معاملات/i);
      fireEvent.change(searchInput, { target: { value: 'پتروشیمی' } });

      await waitFor(() => {
        expect(screen.queryByText('خرید لایسنس سازمانی')).not.toBeInTheDocument();
        expect(screen.getByText('قرارداد توسعه نرم‌افزار')).toBeInTheDocument();
      });
    });
  });
});
