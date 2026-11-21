# Mocking WordPress in JavaScript Unit Tests

## Principle 1: Package Resolution vs Global Mocking
Unit tests run against source files. When source files import from `@wordpress/element`, `@wordpress/components`, or `@wordpress/data`, the test runner resolves these from `node_modules`. You do NOT need to mock them or construct fake `window.wp` trees.

---

## Principle 2: Localized Globals (`wp_localize_script`)
Avoid reading `window.myPluginData` scattered across components. Instead, isolate localized script access behind an adapter function:

```javascript
// src/runtime/config.js
export function getConfig(scope = window) {
  return scope.myPluginData || { apiBase: '/wp-json/plugin/v1/' };
}
```

In unit tests, test the adapter independently for missing globals, malformed types, and default fallbacks.

---

## Principle 3: Testing `@wordpress/api-fetch`

### A. Consumer Testing (Mocking the Module)
When testing UI components that make API requests, mock `@wordpress/api-fetch` at the module level:

```javascript
import apiFetch from '@wordpress/api-fetch';

jest.mock('@wordpress/api-fetch');
// For Vitest: vi.mock('@wordpress/api-fetch');

test('fetches settings', async () => {
  apiFetch.mockResolvedValue({ enabled: true });
  // execute component logic...
});
```

### B. Middleware Testing (Controlling the Transport)
When testing custom `apiFetch` middleware (e.g. custom authentication headers or caching), do not mock the entire module. Instead, execute the middleware directly and mock the `next` handler:

```javascript
const myMiddleware = (options, next) => {
  options.headers = { ...options.headers, 'X-Custom-Header': '123' };
  return next(options);
};

test('middleware attaches header', async () => {
  const nextMock = jest.fn().mockResolvedValue({ status: 200 });
  await myMiddleware({}, nextMock);
  expect(nextMock).toHaveBeenCalledWith({
    headers: { 'X-Custom-Header': '123' },
  });
});
```
