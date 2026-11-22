import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ActivitiesPage } from '../pages/ActivitiesPage';
import { ActivityItemRow } from '../features/activities/components/ActivityItemRow';
import { JalaliCalendarView } from '../features/activities/components/JalaliCalendarView';
import { ActivityCreateModal } from '../features/activities/components/ActivityCreateModal';
import { apiClient } from '../lib/api-client';
import { Task } from '../types/espocrm';

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

describe('Activities & Jalali Calendar Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockTasks: (Task & { type?: 'Task' | 'Call' | 'Meeting' })[] = [
    {
      id: 'task-1',
      name: 'تماس با مدیر خرید پتروشیمی',
      type: 'Call',
      status: 'Not Started',
      priority: 'Urgent',
      dateDue: '2026-11-22T10:00:00.000Z',
      accountName: 'پتروشیمی خلیج',
      contactName: 'مهندس اکبری',
    },
    {
      id: 'task-2',
      name: 'جلسه دمو و ارائه پروپوزال نرم‌افزار',
      type: 'Meeting',
      status: 'Not Started',
      priority: 'High',
      dateDue: '2026-11-23T14:00:00.000Z',
      accountName: 'بانک آینده',
    },
    {
      id: 'task-3',
      name: 'ارسال پیش‌فاکتور رسمی',
      type: 'Task',
      status: 'Completed',
      priority: 'Normal',
      dateDue: '2026-11-20T08:30:00.000Z',
      contactName: 'سارا کاظمی',
    },
  ];

  describe('ActivityItemRow Component', () => {
    it('renders with .bidar-activity-row, shows details, and allows completion with next follow-up action', async () => {
      const onComplete = vi.fn();
      const onScheduleNext = vi.fn();

      render(
        <ActivityItemRow
          activity={mockTasks[0]!}
          onToggleComplete={onComplete}
          onScheduleNext={onScheduleNext}
        />
      );

      const row = screen.getByTestId('activity-row-task-1');
      expect(row).toHaveClass('bidar-activity-row');

      // Title & customer
      expect(screen.getByText('تماس با مدیر خرید پتروشیمی')).toBeInTheDocument();
      expect(screen.getByText(/پتروشیمی خلیج/)).toBeInTheDocument();

      // Priority badge
      expect(screen.getByText(/فوری|Urgent/i)).toBeInTheDocument();

      // Checkbox click
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(onComplete).toHaveBeenCalledWith('task-1', true);
    });

    it('shows schedule next action button when activity is completed', () => {
      const onScheduleNext = vi.fn();
      render(
        <ActivityItemRow
          activity={mockTasks[2]!} // Status is 'Completed'
          onToggleComplete={vi.fn()}
          onScheduleNext={onScheduleNext}
        />
      );

      const nextActionBtn = screen.getByRole('button', { name: /تعریف کار بعدی|پیگیری بعدی/i });
      expect(nextActionBtn).toBeInTheDocument();

      fireEvent.click(nextActionBtn);
      expect(onScheduleNext).toHaveBeenCalledWith(mockTasks[2]!);
    });
  });

  describe('JalaliCalendarView Component', () => {
    it('renders Persian weekdays, current month title, and highlights days with activities', () => {
      render(
        <JalaliCalendarView
          activities={mockTasks}
          onSelectDate={vi.fn()}
          onSelectActivity={vi.fn()}
        />
      );

      // Check weekdays
      expect(screen.getByText('شنبه')).toBeInTheDocument();
      expect(screen.getByText('جمعه')).toBeInTheDocument();

      // Check calendar navigation buttons
      expect(screen.getByRole('button', { name: /ماه قبل/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ماه بعد/i })).toBeInTheDocument();

      // Check current Shamsi month is rendered (e.g. آذر ۱۴۰۵)
      expect(screen.getByText(/۱۴۰۵/)).toBeInTheDocument();
    });
  });

  describe('ActivityCreateModal Component', () => {
    it('validates required title and submits POST on valid form', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        id: 'task-new',
        name: 'بررسی وضعیت قرارداد ابری',
        type: 'Task',
        priority: 'High',
        status: 'Not Started',
      });

      render(
        <ActivityCreateModal
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /ثبت فعالیت|ذخیره/i });

      // Initially empty -> shows validation error
      fireEvent.click(submitBtn);
      expect(screen.getByText(/عنوان فعالیت الزامی است/i)).toBeInTheDocument();

      // Fill form
      fireEvent.change(screen.getByPlaceholderText(/عنوان کار یا فعالیت/i), {
        target: { value: 'بررسی وضعیت قرارداد ابری' },
      });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/Task', expect.objectContaining({
          name: 'بررسی وضعیت قرارداد ابری',
        }));
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe('ActivitiesPage Integration', () => {
    it('renders list view, toggles task completion with PATCH, and switches to Jalali calendar view', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        list: mockTasks,
        total: 3,
      });

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
        id: 'task-1',
        status: 'Completed',
      });

      renderWithClient(<ActivitiesPage />);

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText('تماس با مدیر خرید پتروشیمی')).toBeInTheDocument();
        expect(screen.getByText('جلسه دمو و ارائه پروپوزال نرم‌افزار')).toBeInTheDocument();
      });

      // Complete the first task
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]!);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith('/Task/task-1', {
          status: 'Completed',
        });
      });

      // Switch to Calendar view
      const calendarTabBtn = screen.getByRole('button', { name: /تقویم شمسی|نمای تقویم/i });
      fireEvent.click(calendarTabBtn);

      // Verify calendar view is visible
      await waitFor(() => {
        expect(screen.getByText('شنبه')).toBeInTheDocument();
        expect(screen.getByText('جمعه')).toBeInTheDocument();
      });
    });
  });
});
