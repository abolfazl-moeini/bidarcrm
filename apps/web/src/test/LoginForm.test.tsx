import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LoginForm } from '../features/auth/components/LoginForm';
import { authStore } from '../features/auth/authStore';
import { apiClient, ApiError } from '../lib/api-client';

describe('LoginForm Component & Auth Flow', () => {
  beforeEach(() => {
    authStore.logout();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('renders all form elements with Persian labels', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/نام کاربری یا ایمیل/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/رمز عبور/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ورود به سامانه/i })).toBeInTheDocument();
  });

  it('displays Persian validation errors when submitting empty form', async () => {
    render(<LoginForm />);

    const submitBtn = screen.getByRole('button', { name: /ورود به سامانه/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/لطفاً نام کاربری را وارد کنید/i)).toBeInTheDocument();
      expect(screen.getByText(/لطفاً رمز عبور را وارد کنید/i)).toBeInTheDocument();
    });
  });

  it('shows loading indicator and disables submit button during login request', async () => {
    let resolveLogin: (val: unknown) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });

    vi.spyOn(authStore, 'login').mockImplementation(() => loginPromise as any);

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/نام کاربری یا ایمیل/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText(/رمز عبور/i), {
      target: { value: 'password123' },
    });

    const submitBtn = screen.getByRole('button', { name: /ورود به سامانه/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
      expect(screen.getByText(/در حال ورود/i)).toBeInTheDocument();
    });

    await act(async () => {
      resolveLogin!({ user: { id: '1', userName: 'admin', name: 'Administrator' }, token: 'tok' });
    });
  });

  it('displays Persian error message on 401 Unauthorized', async () => {
    vi.spyOn(authStore, 'login').mockRejectedValue(
      new ApiError(401, 'Unauthorized', { message: 'Invalid credentials' })
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/نام کاربری یا ایمیل/i), {
      target: { value: 'wrong_user' },
    });
    fireEvent.change(screen.getByLabelText(/رمز عبور/i), {
      target: { value: 'wrong_pass' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ورود به سامانه/i }));

    await waitFor(() => {
      expect(screen.getByText(/نام کاربری یا رمز عبور اشتباه است/i)).toBeInTheDocument();
    });
  });

  it('successfully logs in, updates authStore, and triggers onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const mockUser = { id: '1', userName: 'admin', name: 'مدیر سیستم', isAdmin: true };

    vi.spyOn(apiClient, 'request').mockResolvedValue({
      user: mockUser,
      token: 'jwt-auth-token-xyz',
    });

    render(<LoginForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/نام کاربری یا ایمیل/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText(/رمز عبور/i), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: /ورود به سامانه/i }));

    await waitFor(() => {
      expect(authStore.getState().isAuthenticated).toBe(true);
      expect(authStore.getState().user?.userName).toBe('admin');
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
