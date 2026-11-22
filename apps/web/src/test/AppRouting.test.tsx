import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App, { normalizePath } from '../App';
import { authStore } from '../features/auth/authStore';
import { apiClient } from '../lib/api-client';

describe('App Routing & History Synchronization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizePath correctly handles /app prefix, query strings, and trailing slashes', () => {
    expect(normalizePath('/app/dashboard')).toBe('/dashboard');
    expect(normalizePath('/app/kanban')).toBe('/kanban');
    expect(normalizePath('/app/deals/101')).toBe('/deals/101');
    expect(normalizePath('/app/')).toBe('/');
    expect(normalizePath('/app')).toBe('/');
    expect(normalizePath('/deals/101?source=search#section')).toBe('/deals/101');
    expect(normalizePath('/contacts/')).toBe('/contacts');
    expect(normalizePath('/accounts')).toBe('/accounts');
    expect(normalizePath('/activities')).toBe('/activities');
  });

  it('renders AccountsPage when navigating to /accounts', async () => {
    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '1', userName: 'admin', name: 'مدیر کل', isAdmin: true },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [
        { id: 'acc-1', name: 'شرکت فناوران هوشمند', industry: 'فناوری اطلاعات', createdAt: '2026-11-20T00:00:00.000Z' },
      ],
      total: 1,
    });

    window.history.pushState(null, '', '/accounts');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('شرکت‌ها و سازمان‌ها')).toBeInTheDocument();
      expect(screen.getByText('شرکت فناوران هوشمند')).toBeInTheDocument();
    });
  });

  it('opens DealCreateModal when clicking "معامله جدید" in the top bar', async () => {
    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '1', userName: 'admin', name: 'مدیر کل', isAdmin: true },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [],
      total: 0,
    });

    window.history.pushState(null, '', '/dashboard');

    render(<App />);

    const newDealBtn = screen.getByRole('button', { name: /معامله جدید/i });
    expect(newDealBtn).toBeInTheDocument();

    fireEvent.click(newDealBtn);

    await waitFor(() => {
      expect(screen.getByText('ثبت معامله جدید')).toBeInTheDocument();
      expect(screen.getByTestId('deal-name-input')).toBeInTheDocument();
    });
  });
});
