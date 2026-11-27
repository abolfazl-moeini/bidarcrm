import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ContactsTable } from '../features/contacts/components/ContactsTable';
import { ContactQuickCreateModal } from '../features/contacts/components/ContactQuickCreateModal';
import { ContactsPage } from '../pages/ContactsPage';
import { apiClient } from '../lib/api-client';
import { Contact } from '../types/espocrm';

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

describe('Contacts & Accounts Directory - ContactsTable & QuickCreateModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      name: 'علی حسینی',
      firstName: 'علی',
      lastName: 'حسینی',
      accountName: 'شرکت پتروشیمی رازی',
      phoneNumber: '09121112233',
      emailAddress: 'hosseini@razi.ir',
      createdAt: '2026-11-05T09:00:00.000Z',
    },
    {
      id: 'contact-2',
      name: 'سارا کاظمی',
      firstName: 'سارا',
      lastName: 'کاظمی',
      accountName: 'بانک آینده',
      phoneNumber: '09359998877',
      emailAddress: 'kazemi@ayandeh.ir',
      createdAt: '2026-11-12T14:30:00.000Z',
    },
  ];

  describe('ContactsTable Component', () => {
    it('renders with .bidar-contacts-table, shows rows, and contains active tel: and mailto: links', () => {
      render(
        <ContactsTable
          contacts={mockContacts}
          searchQuery=""
          onSearchChange={vi.fn()}
        />
      );

      const table = screen.getByRole('table');
      expect(table).toHaveClass('bidar-contacts-table');

      // Check contact names
      expect(screen.getByText('علی حسینی')).toBeInTheDocument();
      expect(screen.getByText('سارا کاظمی')).toBeInTheDocument();

      // Check companies
      expect(screen.getByText('شرکت پتروشیمی رازی')).toBeInTheDocument();
      expect(screen.getByText('بانک آینده')).toBeInTheDocument();

      // Check tel: and mailto: links
      const phoneLink = screen.getByRole('link', { name: /۰۹۱۲ ۱۱۱ ۲۲۳۳|09121112233/i });
      expect(phoneLink).toHaveAttribute('href', 'tel:09121112233');

      const emailLink = screen.getByRole('link', { name: /hosseini@razi.ir/i });
      expect(emailLink).toHaveAttribute('href', 'mailto:hosseini@razi.ir');
    });

    it('filters rows based on searchQuery by name, phone, or email', () => {
      const { rerender } = render(
        <ContactsTable
          contacts={mockContacts}
          searchQuery="کاظمی"
          onSearchChange={vi.fn()}
        />
      );

      expect(screen.getByText('سارا کاظمی')).toBeInTheDocument();
      expect(screen.queryByText('علی حسینی')).not.toBeInTheDocument();

      // Search by phone
      rerender(
        <ContactsTable
          contacts={mockContacts}
          searchQuery="0912111"
          onSearchChange={vi.fn()}
        />
      );
      expect(screen.getByText('علی حسینی')).toBeInTheDocument();
      expect(screen.queryByText('سارا کاظمی')).not.toBeInTheDocument();
    });
  });

  describe('ContactQuickCreateModal Component', () => {
    it('validates required fields and shows error when submitting empty form', () => {
      const onSubmit = vi.fn();
      render(
        <ContactQuickCreateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSubmit}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /ذخیره مخاطب|ثبت مخاطب/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/نام خانوادگی یا شماره تماس الزامی است|لطفاً فیلدهای الزامی را تکمیل کنید/i)).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('calls POST /api/v1/Contact on valid submit and triggers onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        id: 'contact-3',
        name: 'رضا محمدی',
        firstName: 'رضا',
        lastName: 'محمدی',
        phoneNumber: '09123334455',
        emailAddress: 'mohammadi@test.com',
        accountName: 'توسعه نرم‌افزار فردا',
      });

      render(
        <ContactQuickCreateModal
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/نام کوچک/i), { target: { value: 'رضا' } });
      fireEvent.change(screen.getByPlaceholderText(/نام خانوادگی/i), { target: { value: 'محمدی' } });
      fireEvent.change(screen.getByPlaceholderText(/شماره تماس|موبایل/i), { target: { value: '09123334455' } });
      fireEvent.change(screen.getByPlaceholderText(/ایمیل/i), { target: { value: 'mohammadi@test.com' } });
      fireEvent.change(screen.getByPlaceholderText(/نام شرکت|سازمان/i), { target: { value: 'توسعه نرم‌افزار فردا' } });

      const submitBtn = screen.getByRole('button', { name: /ذخیره مخاطب|ثبت مخاطب/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/Contact', expect.objectContaining({
          firstName: 'رضا',
          lastName: 'محمدی',
          phoneNumber: '09123334455',
          emailAddress: 'mohammadi@test.com',
        }));
        const callPayload = postSpy.mock.calls[0]![1] as Record<string, unknown>;
        expect(callPayload.name).toBeUndefined();
        expect(callPayload.accountName).toBe('توسعه نرم‌افزار فردا');
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe('ContactsPage Integration', () => {
    it('fetches contacts, displays count, and allows opening quick create modal', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        list: mockContacts,
        total: 2,
      });

      renderWithClient(<ContactsPage />);

      await waitFor(() => {
        expect(screen.getByText('علی حسینی')).toBeInTheDocument();
        expect(screen.getByText('سارا کاظمی')).toBeInTheDocument();
      });

      // Check header count badge
      expect(screen.getByText(/۲ مخاطب/)).toBeInTheDocument();

      // Click Add Contact button to open modal
      const addBtn = screen.getByRole('button', { name: /مخاطب جدید/i });
      fireEvent.click(addBtn);

      // Verify modal is open
      expect(screen.getByText(/ثبت سریع مخاطب جدید/i)).toBeInTheDocument();
    });
  });
});
