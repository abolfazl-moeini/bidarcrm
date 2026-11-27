import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { KanbanBoard } from '../features/kanban/components/KanbanBoard';
import { DealCard } from '../features/kanban/components/DealCard';
import { KanbanColumn } from '../features/kanban/components/KanbanColumn';
import { RottenBadge } from '../features/kanban/components/RottenBadge';
import { KanbanPage } from '../pages/KanbanPage';
import { LeadsPage } from '../pages/LeadsPage';
import { ReportsPage } from '../pages/ReportsPage';
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

function createDataTransfer() {
  const data: Record<string, string> = {};
  return {
    data,
    effectAllowed: 'all',
    dropEffect: 'move',
    setData(k: string, v: string) {
      data[k] = v;
    },
    getData(k: string) {
      return data[k] || '';
    },
    types: ['text/plain'],
  };
}

describe('Section 4 Headless SPA Remediation (Kanban DnD, Enum Mapping & UI Standards)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1: prevents duplicate deal rendering across columns when pipelineStageId is set and mappedStatus differs', () => {
    const stages: PipelineStage[] = [
      { id: 'stage-1', name: 'تماس اولیه', order: 1, mappedStatus: 'Prospecting' },
      { id: 'stage-2', name: 'مذاکره اولیه', order: 2, mappedStatus: 'Qualification' },
    ];

    // Deal has already moved to stage-2 (pipelineStageId = stage-2) while stage still holds Prospecting
    const deals: Opportunity[] = [
      {
        id: 'deal-unique',
        name: 'قرارداد ابری سپهر',
        amount: 45000000,
        pipelineStageId: 'stage-2',
        stage: 'Prospecting',
      },
    ];

    render(<KanbanBoard stages={stages} deals={deals} onMoveDeal={vi.fn()} />);

    const col1 = screen.getByTestId('kanban-column-stage-1');
    const col2 = screen.getByTestId('kanban-column-stage-2');

    expect(within(col1).queryByText('قرارداد ابری سپهر')).not.toBeInTheDocument();
    expect(col1).toHaveTextContent('۰ معامله');

    expect(within(col2).getByText('قرارداد ابری سپهر')).toBeInTheDocument();
    expect(col2).toHaveTextContent('۱ معامله');

    // Only one card instance exists in the entire board
    expect(screen.getAllByText('قرارداد ابری سپهر')).toHaveLength(1);
  });

  it('Test 2: maps Persian stage names deterministically to valid EspoCRM stage enums in moveDeal PATCH and never sends Persian text', async () => {
    const stagesWithoutMappedStatus: PipelineStage[] = [
      { id: 'st-prospect', name: 'تماس اولیه', order: 1 },
      { id: 'st-qual', name: 'مذاکره اولیه', order: 2 },
      { id: 'st-prop', name: 'ارسال پیش‌فاکتور', order: 3 },
      { id: 'st-neg', name: 'مذاکره نهایی', order: 4 },
      { id: 'st-won', name: 'فروش موفق', order: 5 },
      { id: 'st-lost', name: 'ناموفق (از دست رفته)', order: 6 },
    ];

    const deal: Opportunity = {
      id: 'deal-enum-1',
      name: 'پروژه نرم‌افزاری بیدار',
      amount: 120000000,
      pipelineStageId: 'st-prospect',
      stage: 'Prospecting',
    };

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('Pipeline')) {
        return { list: [{ id: 'pipe-1', name: 'فروش اصلی', stages: stagesWithoutMappedStatus }] };
      }
      return { list: [deal], total: 1 };
    });

    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({ id: 'deal-enum-1' });

    renderWithClient(<KanbanPage />);

    await waitFor(() => {
      expect(screen.getByTestId('deal-card-deal-enum-1')).toBeInTheDocument();
    });

    const validEnums = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    const expectations: Array<{ colId: string; expectedEnum: string }> = [
      { colId: 'st-qual', expectedEnum: 'Qualification' },
      { colId: 'st-prop', expectedEnum: 'Proposal' },
      { colId: 'st-neg', expectedEnum: 'Negotiation' },
      { colId: 'st-won', expectedEnum: 'Closed Won' },
    ];

    for (const { colId, expectedEnum } of expectations) {
      const card = screen.getByTestId('deal-card-deal-enum-1');
      const col = screen.getByTestId(`kanban-column-${colId}`);
      const dt = createDataTransfer();

      fireEvent.dragStart(card, { dataTransfer: dt });
      fireEvent.dragOver(col, { dataTransfer: dt });
      fireEvent.drop(col, { dataTransfer: dt });

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith(
          '/Opportunity/deal-enum-1',
          expect.objectContaining({
            pipelineStageId: colId,
            stage: expectedEnum,
          })
        );
      });

      const lastCallPayload = patchSpy.mock.calls[patchSpy.mock.calls.length - 1]?.[1] as { stage?: string };
      expect(validEnums).toContain(lastCallPayload.stage);
      expect(lastCallPayload.stage).not.toMatch(/[\u0600-\u06FF]/);
    }

    // Verify Closed Lost triggers LossReasonModal and sends 'Closed Lost' enum
    const cardForLost = screen.getByTestId('deal-card-deal-enum-1');
    const lostCol = screen.getByTestId('kanban-column-st-lost');
    const lostDt = createDataTransfer();

    fireEvent.dragStart(cardForLost, { dataTransfer: lostDt });
    fireEvent.dragOver(lostCol, { dataTransfer: lostDt });
    fireEvent.drop(lostCol, { dataTransfer: lostDt });

    await waitFor(() => {
      expect(screen.getByTestId('confirm-loss-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-loss-button'));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        '/Opportunity/deal-enum-1',
        expect.objectContaining({
          pipelineStageId: 'st-lost',
          stage: 'Closed Lost',
        })
      );
    });
  });

  it('Test 3: suppresses DealCard onClick immediately after dragEnd and re-enables click after 100ms', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const deal: Opportunity = {
      id: 'deal-drag-click',
      name: 'معامله تست کلیک',
      amount: 10000000,
    };

    render(<DealCard deal={deal} onClick={onClick} />);
    const card = screen.getByTestId('deal-card-deal-drag-click');
    const dt = createDataTransfer();

    // Drag start -> drag end -> immediate click must be suppressed
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.dragEnd(card);
    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();

    // Click within 50ms is still suppressed
    vi.advanceTimersByTime(50);
    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();

    // After 100ms has elapsed since dragEnd, click works normally
    vi.advanceTimersByTime(60);
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Test 4: rolls back optimistic move and displays Persian error alert when server PATCH fails', async () => {
    const stages: PipelineStage[] = [
      { id: 's-1', name: 'تماس اولیه', order: 1, mappedStatus: 'Prospecting' },
      { id: 's-2', name: 'مذاکره اولیه', order: 2, mappedStatus: 'Qualification' },
    ];
    const deals: Opportunity[] = [
      {
        id: 'deal-rb-1',
        name: 'معامله رول‌بک',
        amount: 25000000,
        pipelineStageId: 's-1',
        stage: 'Prospecting',
      },
    ];

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('Pipeline')) {
        return { list: [{ id: 'pipe-1', name: 'فروش', stages }] };
      }
      return { list: deals, total: 1 };
    });

    vi.spyOn(apiClient, 'patch').mockRejectedValue(
      new ApiError(400, 'Bad Request', 'Invalid stage')
    );

    renderWithClient(<KanbanPage />);

    await waitFor(() => {
      expect(screen.getByTestId('deal-card-deal-rb-1')).toBeInTheDocument();
    });

    const card = screen.getByTestId('deal-card-deal-rb-1');
    const targetCol = screen.getByTestId('kanban-column-s-2');
    const dt = createDataTransfer();

    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.dragOver(targetCol, { dataTransfer: dt });
    fireEvent.drop(targetCol, { dataTransfer: dt });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/خطا در انتقال معامله/);
    });

    // Deal must be restored back to s-1 and absent from s-2
    expect(within(screen.getByTestId('kanban-column-s-1')).getByText('معامله رول‌بک')).toBeInTheDocument();
    expect(within(screen.getByTestId('kanban-column-s-2')).queryByText('معامله رول‌بک')).not.toBeInTheDocument();
  });

  it('Test 5: enforces Vazirmatn typography and nowrap status badges (whitespace-nowrap shrink-0)', async () => {
    // RottenBadge + KanbanColumn badge
    const { container: colContainer } = render(
      <div>
        <RottenBadge isRotten={true} daysSinceLastActivity={5} />
        <KanbanColumn
          stage={{ id: 's-1', name: 'مذاکره', order: 1 }}
          deals={[]}
          onDropDeal={vi.fn()}
        />
      </div>
    );

    const rottenBadge = colContainer.querySelector('.bidar-rotten-badge');
    expect(rottenBadge).toHaveClass('whitespace-nowrap', 'shrink-0');

    const colCountBadge = screen.getByText(/۰ معامله/);
    expect(colCountBadge).toHaveClass('whitespace-nowrap', 'shrink-0');

    // LeadsPage status badge & Vazirmatn table headers
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/Lead')) {
        return {
          list: [{ id: 'lead-1', name: 'سرنخ آزمایشی', status: 'New' }],
          total: 1,
        };
      }
      return {
        openCount: 2,
        openAmount: 10000000,
        wonCount: 1,
        wonAmount: 5000000,
        rottenCount: 0,
        overdueActivitiesCount: 0,
        conversionRate: 50,
        avgSalesCycleDays: 7,
        funnelStages: [],
        lossReasonsBreakdown: [],
        topSalesReps: [],
        leadSourceBreakdown: [],
      };
    });

    const { container: leadsContainer } = renderWithClient(<LeadsPage />);
    await waitFor(() => {
      expect(screen.getByText('سرنخ آزمایشی')).toBeInTheDocument();
    });

    const statusBadge = screen.getByText('جدید');
    expect(statusBadge).toHaveClass('whitespace-nowrap', 'shrink-0');
    leadsContainer.querySelectorAll('th').forEach((th) => {
      expect(th).toHaveClass('font-vazirmatn');
    });

    const { container: reportsContainer } = renderWithClient(<ReportsPage />);
    await waitFor(() => {
      expect(reportsContainer.querySelectorAll('.report-card').length).toBeGreaterThanOrEqual(4);
    });
    reportsContainer.querySelectorAll('.kpi-value').forEach((el) => {
      expect(el).toHaveClass('font-vazirmatn');
    });
  });
});
