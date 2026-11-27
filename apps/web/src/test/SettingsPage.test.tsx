import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from '../pages/SettingsPage';
import { apiClient } from '../lib/api-client';

describe('SettingsPage Security, Error Handling & Styling (A1, A2, C1, C2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays inline error state instead of fake mock keys when GET /BidarApiKey/action/list fails', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('خطای سرور در دریافت کلیدها'));

    const { container } = render(<SettingsPage />);

    expect(await screen.findByText('خطای سرور در دریافت کلیدها')).toBeInTheDocument();
    expect(screen.queryByText('کلید وب‌سایت فروشگاهی')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('primary-');
  });

  it('keeps modal open and shows inline error without fabricating fake key when POST /BidarApiKey fails', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ list: [] });
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('خطا در ساخت کلید API'));

    render(<SettingsPage />);

    const openModalBtn = await screen.findByRole('button', { name: /تولید کلید جدید/i });
    expect(openModalBtn.className).toContain('bg-emerald-');
    fireEvent.click(openModalBtn);

    const nameInput = screen.getByPlaceholderText(/فروشگاه ووکامرس/i);
    fireEvent.change(nameInput, { target: { value: 'کلید تست' } });

    const submitBtn = screen.getByRole('button', { name: /تولید کلید$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('خطا در ساخت کلید API')).toBeInTheDocument();
    expect(screen.queryByText(/bidar_live_/i)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('uses inline React confirmation modal instead of window.confirm when revoking a key', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [
        {
          id: 'key-1',
          name: 'کلید واقعی',
          keyPrefix: 'bidar_live_abc123',
          scopes: ['read'],
          isActive: true,
          createdAt: '2025-04-01T10:00:00Z',
        },
      ],
    });
    vi.spyOn(apiClient, 'delete').mockRejectedValue(new Error('لغو کلید ناموفق بود'));

    render(<SettingsPage />);

    const revokeBtn = await screen.findByTitle('ابطال کلید');
    fireEvent.click(revokeBtn);

    expect(confirmSpy).not.toHaveBeenCalled();
    const confirmRevokeBtn = await screen.findByRole('button', { name: /تایید ابطال کلید/i });
    fireEvent.click(confirmRevokeBtn);

    expect(await screen.findByText('لغو کلید ناموفق بود')).toBeInTheDocument();
    expect(screen.getByText('کلید واقعی')).toBeInTheDocument();
  });

  it('displays inline error state instead of fake mock products when GET /BidarProduct fails', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('BidarProduct')) {
        throw new Error('خطای دریافت محصولات');
      }
      return { list: [] };
    });

    render(<SettingsPage />);

    const productsTab = screen.getByRole('button', { name: /محصولات و خدمات/i });
    fireEvent.click(productsTab);

    await waitFor(() => {
      expect(screen.getByText('خطای دریافت محصولات')).toBeInTheDocument();
    });
    expect(screen.queryByText('اشتراک سالانه نرم‌افزار')).not.toBeInTheDocument();
  });
});
