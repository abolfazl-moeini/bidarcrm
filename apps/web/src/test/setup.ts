import '@testing-library/jest-dom';

// Polyfill localStorage for Node.js 22+ jsdom test environment
if (typeof window !== 'undefined') {
  let store: Record<string, string> = {};
  const storageMock: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };

  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    configurable: true,
    writable: true,
  });
}
