import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoipCallToast } from '../components/layout/VoipCallToast';
import { apiClient } from '../lib/api-client';

describe('VoipCallToast (A1, B5, C1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with emerald classes (no primary-*), Persian digits, and posts real /Note on save', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ id: 'note-1' });
    const { container } = render(<VoipCallToast />);

    window.dispatchEvent(
      new CustomEvent('bidar:incoming_call', {
        detail: {
          callerPhone: '09123456789',
          callerName: 'سارا محمدی',
          contactId: 'contact-1',
        },
      })
    );

    expect(await screen.findByText('سارا محمدی')).toBeInTheDocument();
    expect(screen.getByText(/۰۹۱۲/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('primary-');

    fireEvent.click(screen.getByRole('button', { name: /ثبت سریع یادداشت/i }));
    const noteInput = screen.getByPlaceholderText(/یادداشت/i);
    fireEvent.change(noteInput, { target: { value: 'تماس موفق بود' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت یادداشت/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/Note',
        expect.objectContaining({
          parentType: 'Contact',
          parentId: 'contact-1',
          post: 'تماس موفق بود',
        })
      );
    });
  });

  it('shows inline error instead of fake savedSuccess when /Note POST fails', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('خطای ثبت یادداشت تماس'));
    render(<VoipCallToast />);

    window.dispatchEvent(
      new CustomEvent('bidar:incoming_call', {
        detail: {
          callerPhone: '09123456789',
          callerName: 'سارا محمدی',
          contactId: 'contact-1',
        },
      })
    );

    await screen.findByText('سارا محمدی');
    fireEvent.click(screen.getByRole('button', { name: /ثبت سریع یادداشت/i }));
    const noteInput = await screen.findByPlaceholderText(/یادداشت/i);
    fireEvent.change(noteInput, { target: { value: 'تست خطا' } });
    fireEvent.click(screen.getByRole('button', { name: /ثبت یادداشت/i }));

    expect(await screen.findByText(/خطای ثبت یادداشت تماس/i)).toBeInTheDocument();
    expect(screen.queryByText(/با موفقیت ثبت شد/i)).not.toBeInTheDocument();
  });
});
