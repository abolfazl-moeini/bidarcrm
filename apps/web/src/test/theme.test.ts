import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getInitialTheme, applyTheme, toggleThemeMode, THEME_STORAGE_KEY } from '../lib/theme';

describe('BidarCRM Dark/Light Theme Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');
    vi.restoreAllMocks();
  });

  it('defaults to light theme when no storage preference exists and system prefers light', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false, // not dark
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const theme = getInitialTheme();
    expect(theme).toBe('light');
  });

  it('respects stored theme in localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getInitialTheme()).toBe('dark');

    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getInitialTheme()).toBe('light');
  });

  it('correctly toggles between light and dark', () => {
    expect(toggleThemeMode('light')).toBe('dark');
    expect(toggleThemeMode('dark')).toBe('light');
  });

  it('applies dark class to document.documentElement when dark is set', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('removes dark class and applies light when light is set', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
