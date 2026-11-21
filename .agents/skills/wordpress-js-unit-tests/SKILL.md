---
name: wordpress-js-unit-tests
description: >-
  Standardized JavaScript unit and component testing for WordPress plugins.
  Adaptive runner profiles (Jest via @wordpress/scripts and standalone Vitest),
  @testing-library/react for Gutenberg blocks and wp-admin SPAs, modular mock
  isolation for @wordpress/api-fetch and localized PHP globals, and vanilla DOM testing.
---

# WordPress JavaScript Unit Tests

Standardized, sub-second JavaScript unit and component testing for WordPress plugins, Gutenberg blocks, wp-admin interfaces, and vanilla frontend DOM scripts.

**Complements:**
- [`wordpress-plugin-unit-tests`](../wordpress-plugin-unit-tests/SKILL.md): Backend PHPUnit testing.
- [`wordpress-e2e-tests`](../wordpress-e2e-tests/SKILL.md): Real-browser Playwright E2E testing.

---

## 🏛️ Core Architectural Invariant: Source vs Deployment Bundle

A frequent architectural anti-pattern in WordPress plugin testing is fabricating artificial `window.wp.*` global trees in unit tests.
- **In Production:** `@wordpress/dependency-extraction-webpack-plugin` extracts `@wordpress/*` imports at build time and maps them to global script dependencies enqueued by WordPress Core (`window.wp.element`, `window.wp.components`, etc.).
- **In Unit Tests:** Test runners (Jest / Vitest) execute against **source code** (`src/`) resolving `@wordpress/*` packages directly from `node_modules`.

> **The Golden Rule:** Never create `window.wp` shims in unit tests unless the source code under test explicitly calls legacy `window.wp.*` handles (e.g. `window.wp.ajax` or `wp.media`).

---

## 🧭 Adaptive Runner Discovery Protocol

Do not arbitrarily force a test runner. Follow this structured discovery:
1. **Inspect Existing Setup:** Check `package.json` and lockfiles. If a working runner (Jest or Vitest) exists, preserve it.
2. **Select Profile for Greenfield Projects:**
   - **Jest Profile:** For plugins using standard `@wordpress/scripts` (runs Jest via `wp-scripts test-unit-js`).
   - **Vitest Profile:** For plugins using Vite, native ESM, or modern standalone Vitest (runs `vitest run` in CI and `vitest` in watch mode).
   - See detailed decision criteria in [runner-selection.md](references/runner-selection.md).

---

## 📋 DO / DON'T Rules (AXI Guardrails)

### DO
- **DO** test source files (`src/**/*.{js,jsx,ts,tsx}`) directly from `node_modules/@wordpress/*`.
- **DO** use `@testing-library/react` and `@testing-library/user-event` for testing React and Gutenberg block components.
- **DO** use a stateful test harness for Gutenberg `edit.js` components that updates attributes on change, asserting re-render behavior.
- **DO** mock `@wordpress/api-fetch` at the module level for consumer tests (`jest.mock` / `vi.mock`), or test custom middleware via controlled transport mocks.
- **DO** isolate PHP-localized globals (`wp_localize_script`) behind a single configuration adapter and test missing/malformed values.
- **DO** restore mocks and clean up injected globals in `afterEach()`.

### DON'T
- **DON'T** mock `window.wp` merely because source code imports `@wordpress/*`.
- **DON'T** use `enzyme` or `react-test-renderer` — both are deprecated in modern WordPress tooling.
- **DON'T** mock `window.fetch` globally when testing code that uses `@wordpress/api-fetch`.
- **DON'T** enter interactive watch mode in CI — always execute single-run commands (`wp-scripts test-unit-js` or `vitest run`).
- **DON'T** use brittle full-string snapshots for Gutenberg blocks; prefer semantic DOM assertions.

---

## 🚀 Greenfield Setup Procedure

### 1. Identify Runner & Merge Dependencies
Inspect the plugin's `package.json`. Merge common dependencies from `assets/templates/package.json.partial`:
```bash
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- **For Jest:** Merge `assets/templates/jest/package.json.partial` (`@wordpress/scripts`).
- **For Vitest:** Merge `assets/templates/vitest/package.json.partial` (`vitest`, `vite`, `jsdom`, `@vitejs/plugin-react`).

### 2. Copy Templates into Project Root
From `assets/templates/`:
- **For Jest:**
  - Copy `jest/jest.config.cjs` to plugin root.
  - Copy `jest/setup-jest.js` to `tests/unit-js/setup.js`.
- **For Vitest:**
  - Copy `vitest/vitest.config.mjs` to plugin root.
  - Copy `vitest/setup-vitest.js` to `tests/unit-js/setup.js`.

### 3. Run Verification
```bash
# For Jest:
npm run test:unit:js

# For Vitest:
npm run test:unit:js
```

---

## 🧩 Canonical Examples & References

- **Pure Logic (Node Environment):** [pure-logic.test.js](assets/templates/examples/common/pure-logic.test.js) (runs in Node environment without JSDOM)
- **Runtime Configuration Adapter:** [config-adapter.test.js](assets/templates/examples/common/config-adapter.test.js) (safe fallback for PHP localized data)
- **Vanilla DOM:** [Jest](assets/templates/examples/jest/vanilla-dom.test.js) | [Vitest](assets/templates/examples/vitest/vanilla-dom.test.js) (form submission & listener cleanup)
- **Gutenberg Block Edit:** [Jest](assets/templates/examples/jest/block-edit.test.jsx) | [Vitest](assets/templates/examples/vitest/block-edit.test.jsx) (stateful harness, StrictMode, unmount)
- **REST API & Middleware:** [Jest](assets/templates/examples/jest/api-fetch.test.js) | [Vitest](assets/templates/examples/vitest/api-fetch.test.js) (module mock & middleware transport)

### In-Depth References
- [runner-selection.md](references/runner-selection.md) — Jest vs Vitest decision criteria
- [ci-and-isolation.md](references/ci-and-isolation.md) — CI execution, memory limits & isolation
- [compatibility.md](references/compatibility.md) — Toolchain compatibility matrix
- [gutenberg-testing.md](references/gutenberg-testing.md) — Stateful block harnesses & stores
- [mocking-wordpress.md](references/mocking-wordpress.md) — Mocking `@wordpress/*` packages & globals
