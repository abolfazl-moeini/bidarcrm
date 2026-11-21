import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

/**
 * Global Vitest Test Setup Shim for WordPress Plugins.
 * Keeps globals clean by default; use explicit test helpers to inject localized data.
 * Compatible with both JSDOM and Node test environments.
 */

// Safe fallback for window.matchMedia in JSDOM
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  // Clean up any test-injected globals if running in browser/JSDOM
  if (typeof window !== 'undefined') {
    delete window.myPluginSettings;
    delete window.wpApiSettings;
  }

  // Restore real timers if fake timers were enabled in tests
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
