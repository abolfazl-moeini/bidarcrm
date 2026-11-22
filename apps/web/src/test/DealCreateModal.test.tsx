import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DealCreateModal, parseTomanAmount } from '../features/kanban/components/DealCreateModal';
import { apiClient } from '../lib/api-client';

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

describe('DealCreateModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parseTomanAmount correctly converts Persian and Western digits with commas', () => {
    expect(parseTomanAmount('')).toBe(0);
    expect(parseTomanAmount('25000000')).toBe(25000000);
    expect(parseTomanAmount('۲۵,۰۰۰,۰۰۰')).toBe(25000000);
    expect(parseTomanAmount('۱۲۰،۵۰۰،۰۰۰')).toBe(120500000);
    expect(parseTomanAmount('۵۰ ۰۰۰ ۰۰۰')).toBe(50000000);
  });

  it('renders modal with Persian labels when open', () => {
    renderWithClient(
      <DealCreateModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('ثبت معامله جدید')).toBeInTheDocument();
    expect(screen.getByText(/نام معامله/i)).toBeInTheDocument();
    expect(screen.getByText(/مبلغ معامله/i)).toBeInTheDocument();
    expect(screen.getByText(/کاریز فروش/i)).toBeInTheDocument();
    expect(screen.getByText(/مرحله کاریز/i)).toBeInTheDocument();
  });

  it('validates required name field before submitting', async () => {
    renderWithClient(
      <DealCreateModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /ایجاد معامله/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/نام معامله الزامی است/i)).toBeInTheDocument();
  });

  it('submits POST /Opportunity with parsed Toman amount and triggers callbacks', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      id: 'deal-new-1',
      name: 'فروش لایسنس سازمانی',
      amount: 45000000,
      stage: 'سرنخ جدید',
    });

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderWithClient(
      <DealCreateModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByTestId('deal-name-input'), {
      target: { value: 'فروش لایسنس سازمانی' },
    });
    fireEvent.change(screen.getByTestId('deal-amount-input'), {
      target: { value: '۴۵,۰۰۰,۰۰۰' },
    });

    const submitBtn = screen.getByRole('button', { name: /ایجاد معامله/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/Opportunity', expect.objectContaining({
        name: 'فروش لایسنس سازمانی',
        amount: 45000000,
      }));
    });

    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
