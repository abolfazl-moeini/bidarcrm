import '@testing-library/jest-dom';

/**
 * Global Jest Test Setup Shim for WordPress Plugins.
 * Keeps globals clean by default; use explicit test helpers to inject localized data.
 * Compatible with both JSDOM and Node test environments.
 */

// Safe fallback for window.matchMedia in JSDOM
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
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
  if (typeof jest !== 'undefined') {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  }
});
