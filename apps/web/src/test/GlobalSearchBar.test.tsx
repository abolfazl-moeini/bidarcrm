import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalSearchBar } from '../components/layout/GlobalSearchBar';
import { apiClient } from '../lib/api-client';

describe('GlobalSearchBar (A1, B3, B5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('supports keyboard navigation, Escape close, and navigates to /contacts?id=...&search=...', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      list: [
        {
          id: 'c-1',
          name: 'رضا کریمی',
          _scope: 'Contact',
          phoneNumber: '09121112233',
        },
      ],
    });

    const onNavigate = vi.fn();
    render(<GlobalSearchBar onNavigate={onNavigate} />);

    const triggerInput = screen.getByPlaceholderText(/جستجو در معاملات/i);
    fireEvent.focus(triggerInput);
    const inputs = await screen.findAllByPlaceholderText(/جستجو در معاملات/i);
    const input = inputs[inputs.length - 1]!;

    fireEvent.change(input, { target: { value: 'رضا' } });

    await waitFor(() => {
      expect(screen.getByText('رضا کریمی')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/contacts?id=c-1'));
    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('search='));
  });

  it('closes cleanly on Escape, blurs trigger input, and does not re-open modal due to focus bounce', async () => {
    render(<GlobalSearchBar />);

    const triggerInput = screen.getByPlaceholderText(/جستجو در معاملات.*Ctrl\+K/i);
    fireEvent.focus(triggerInput);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Press Escape on window or modal
    fireEvent.keyDown(window, { key: 'Escape' });

    // Ensure dialog is closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Ensure trigger input is blurred and dialog does NOT bounce back open
    expect(triggerInput).not.toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
