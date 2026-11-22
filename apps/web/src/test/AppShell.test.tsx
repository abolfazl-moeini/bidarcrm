import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';
import { authStore } from '../features/auth/authStore';

describe('AppShell Component & Layout Structure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all primary sidebar navigation items in Persian', () => {
    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '1', userName: 'sales_rep', name: 'کارشناس فروش', isAdmin: false },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    render(
      <AppShell>
        <div>محتوای تست</div>
      </AppShell>
    );

    expect(screen.getByText(/داشبورد/i)).toBeInTheDocument();
    expect(screen.getByText(/کاریز معاملات/i)).toBeInTheDocument();
    expect(screen.getByText(/مخاطبان و شرکت‌ها/i)).toBeInTheDocument();
    expect(screen.getByText(/فعالیت‌ها و تقویم/i)).toBeInTheDocument();
    expect(screen.getByText('محتوای تست')).toBeInTheDocument();
  });

  it('renders admin panel link when user has admin role', () => {
    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '1', userName: 'admin', name: 'مدیر کل سیستم', isAdmin: true },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    render(
      <AppShell>
        <div>صفحه اصلی</div>
      </AppShell>
    );

    const adminLink = screen.getByRole('link', { name: /تنظیمات سیستم|پنل مدیریت/i });
    expect(adminLink).toBeInTheDocument();
    expect(adminLink).toHaveAttribute('href', '/admin');
    expect(adminLink).toHaveAttribute('target', '_self');
  });

  it('does NOT render admin panel link when user is not an admin', () => {
    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '2', userName: 'regular_user', name: 'کاربر عادی', isAdmin: false },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    render(
      <AppShell>
        <div>صفحه عادی</div>
      </AppShell>
    );

    const adminLink = screen.queryByRole('link', { name: /تنظیمات سیستم|پنل مدیریت/i });
    expect(adminLink).not.toBeInTheDocument();
  });

  it('focuses global search input on Ctrl+K and Cmd+K keyboard shortcuts', () => {
    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '1', userName: 'admin', name: 'مدیر سیستم', isAdmin: true },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    render(
      <AppShell>
        <div>تست کیبورد</div>
      </AppShell>
    );

    const searchInput = screen.getByPlaceholderText(/جستجو در معاملات، مخاطبان و شرکت‌ها/i);
    expect(document.activeElement).not.toBe(searchInput);

    // Simulate Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(searchInput);

    // Blur and simulate Cmd+K (metaKey)
    searchInput.blur();
    expect(document.activeElement).not.toBe(searchInput);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(searchInput);
  });

  it('displays user name in header and executes logout when clicking logout button', () => {
    const logoutSpy = vi.spyOn(authStore, 'logout').mockResolvedValue();

    vi.spyOn(authStore, 'getState').mockReturnValue({
      user: { id: '1', userName: 'abolfazl', name: 'ابوالفضل معینی', isAdmin: true },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    render(
      <AppShell>
        <div>ناحیه محتوا</div>
      </AppShell>
    );

    expect(screen.getByText('ابوالفضل معینی')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /معامله جدید/i })).toBeInTheDocument();

    const logoutBtn = screen.getByRole('button', { name: /خروج از حساب|خروج/i });
    expect(logoutBtn).toBeInTheDocument();

    fireEvent.click(logoutBtn);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });
});
