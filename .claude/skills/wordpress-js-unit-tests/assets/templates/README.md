# WordPress JavaScript Unit Test Templates

This directory provides standardized templates for JavaScript unit and component testing in WordPress plugins.

## 📂 Layout

```text
assets/templates/
├── package.json.partial              # Common dependencies (@testing-library/*)
├── jest/
│   ├── package.json.partial          # Jest runner scripts & @wordpress/scripts
│   ├── jest.config.cjs               # Jest configuration (extends @wordpress/jest-preset-default)
│   └── setup-jest.js                 # Setup shim with cleanup & DOM matchers
├── vitest/
│   ├── package.json.partial          # Vitest runner scripts & dependencies (vitest, @vitest/coverage-v8, jsdom)
│   ├── vitest.config.mjs             # Standalone Vitest config with React JSX plugin
│   └── setup-vitest.js               # Vitest setup shim with cleanup & DOM matchers
└── examples/
    ├── common/                       # Runner-neutral examples (no runner mock APIs)
    │   ├── pure-logic.test.js        # Pure logic testing in Node environment with isolation assertions
    │   └── config-adapter.test.js    # PHP localized script configuration adapter testing
    ├── jest/                         # Jest-specific mock-bearing canonical examples
    │   ├── vanilla-dom.test.js       # Vanilla DOM & form submission with jest.fn() & listener cleanup
    │   ├── block-edit.test.jsx       # Gutenberg Edit with stateful harness, StrictMode & unmount tests
    │   └── api-fetch.test.js         # Real @wordpress/api-fetch module mock & transport middleware
    └── vitest/                       # Vitest-specific mock-bearing canonical examples
        ├── vanilla-dom.test.js       # Vanilla DOM & form submission with vi.fn() & listener cleanup
        ├── block-edit.test.jsx       # Gutenberg Edit with stateful harness, StrictMode & unmount tests
        └── api-fetch.test.js         # Real @wordpress/api-fetch vi.mock() & transport middleware
```

## 🚀 Usage Guide

1. **Detect Runner**: Inspect your plugin's `package.json` and lockfile.
   - If `@wordpress/scripts` is already used with Jest: use the **Jest Profile** (`jest/`).
   - If using Vite, native ESM, or modern standalone Vitest: use the **Vitest Profile** (`vitest/`).
2. **Merge Dependencies**: Merge the common `package.json.partial` and your selected runner's `package.json.partial` into your plugin's root `package.json`.
3. **Copy Configuration**:
   - For Jest: Copy `jest/jest.config.cjs` to plugin root, and `jest/setup-jest.js` to `tests/unit-js/setup.js`.
   - For Vitest: Copy `vitest/vitest.config.mjs` to plugin root, and `vitest/setup-vitest.js` to `tests/unit-js/setup.js`.
4. **Copy Examples**:
   - For Jest: Copy `examples/common/*` and `examples/jest/*` to `tests/unit-js/`.
   - For Vitest: Copy `examples/common/*` and `examples/vitest/*` to `tests/unit-js/`.
