import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LossReasonModal } from '../features/deals/components/LossReasonModal';
import { LossReasonsWidget } from '../features/dashboard/components/LossReasonsWidget';
import { SalesGoalWidget } from '../features/dashboard/components/SalesGoalWidget';

describe('BidarCRM Gap Features (GAP-01, GAP-03, GAP-07)', () => {
  describe('GAP-01: LossReasonModal', () => {
    it('renders modal with standardized loss reasons and handles submit', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <LossReasonModal
          isOpen={true}
          dealName="قرارداد سرور سازمانی"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );

      expect(screen.getByText('ثبت دلیل شکست معامله')).toBeInTheDocument();
      expect(screen.getByText(/قرارداد سرور سازمانی/)).toBeInTheDocument();
      expect(screen.getByText(/علت عدم موفقیت/)).toBeInTheDocument();

      // Enter optional note
      const noteInput = screen.getByPlaceholderText(/نکات مورد نظر در خصوص علت از دست رفتن معامله.../);
      fireEvent.change(noteInput, { target: { value: 'عدم تطابق قیمت با بودجه سالانه' } });

      // Click submit
      const confirmButton = screen.getByTestId('confirm-loss-button');
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith('PriceTooHigh', 'عدم تطابق قیمت با بودجه سالانه');
    });

    it('does not render when isOpen is false', () => {
      const { container } = render(
        <LossReasonModal
          isOpen={false}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('GAP-03: LossReasonsWidget', () => {
    it('renders list of loss reasons with counts and percentage bars', () => {
      const testReasons = [
        { reason: 'PriceTooHigh', label: 'قیمت بالا', count: 6, amount: 60000000 },
        { reason: 'Competitor', label: 'انتخاب رقیب', count: 4, amount: 40000000 },
      ];

      render(<LossReasonsWidget reasons={testReasons} />);

      expect(screen.getByText('تحلیل دلایل شکست معاملات')).toBeInTheDocument();
      expect(screen.getByText('قیمت بالا')).toBeInTheDocument();
      expect(screen.getByText('انتخاب رقیب')).toBeInTheDocument();
      expect(screen.getByText(/۱۰ مورد باخته/)).toBeInTheDocument();
    });

    it('renders empty state when reasons array is empty', () => {
      render(<LossReasonsWidget reasons={[]} />);
      expect(screen.getByText(/معامله ناموفقی در این دوره گزارش نشده است/)).toBeInTheDocument();
    });
  });

  describe('GAP-07: SalesGoalWidget', () => {
    it('calculates completion percentage and remaining gap correctly', () => {
      render(
        <SalesGoalWidget
          goalName="هدف فروش سه‌ماهه"
          targetAmount={1000000000}
          currentAmount={750000000}
        />
      );

      expect(screen.getByText('هدف فروش سه‌ماهه')).toBeInTheDocument();
      expect(screen.getByText(/۷۵٪/)).toBeInTheDocument();
      expect(screen.getByText(/۷۵۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();
      expect(screen.getByText(/۱,۰۰۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();
      expect(screen.getByText(/۲۵۰,۰۰۰,۰۰۰ تومان/)).toBeInTheDocument();
    });
  });

  describe('BUG-BIDAR-SEARCH-SCOPE-001: GlobalSearchBar _scope handling', () => {
    it('correctly categorizes results returning _scope: "Opportunity", "Contact", "Account"', async () => {
      const { default: GlobalSearchBar } = await import('../components/layout/GlobalSearchBar');
      const { apiClient } = await import('../lib/api-client');

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        list: [
          { id: 'opp-1', name: 'معامله سرور ابری', _scope: 'Opportunity' },
          { id: 'cnt-1', name: 'آرش پیروز‌فر', _scope: 'Contact' },
          { id: 'acc-1', name: 'شرکت فناوران موج', _scope: 'Account' },
          { id: 'lead-1', name: 'سرنخ بازاریابی', _scope: 'Lead' },
        ],
        total: 4,
      } as any);

      render(<GlobalSearchBar />);

      // Focus input to open modal
      const headerInput = screen.getByPlaceholderText(/جستجو در معاملات، مخاطبان و شرکت‌ها/);
      fireEvent.focus(headerInput);

      // Type search term
      const modalInput = screen.getByPlaceholderText(/جستجو در معاملات، مخاطبان، شرکت‌ها و سرنخ‌ها/);
      fireEvent.change(modalInput, { target: { value: 'معامله' } });

      // Wait for debounce and state update
      await vi.waitFor(() => {
        expect(screen.getByText(/معاملات \(۱\)/)).toBeInTheDocument();
        expect(screen.getByText('معامله سرور ابری')).toBeInTheDocument();
        expect(screen.getByText(/مخاطبان \(۱\)/)).toBeInTheDocument();
        expect(screen.getByText('آرش پیروز‌فر')).toBeInTheDocument();
        expect(screen.getByText(/شرکت‌ها \(۱\)/)).toBeInTheDocument();
        expect(screen.getByText('شرکت فناوران موج')).toBeInTheDocument();
      });

      // Verify it's not grouped under "سایر نتایج" for the deal/contact/account
      expect(screen.queryByText(/سایر نتایج/)).toBeInTheDocument(); // lead-1 is in others
      expect(screen.getByText('سرنخ بازاریابی')).toBeInTheDocument();
    });
  });
});
