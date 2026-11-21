# Runner Selection Guide: Jest vs Vitest for WordPress Plugins

Do not guess or arbitrarily enforce a test runner. Follow this structured discovery protocol:

---

## 🔍 Discovery Protocol

### Step 1: Inspect Project Configuration & Lockfile
1. Open the plugin's root `package.json`:
   - Does `"scripts"` already have `"test:unit:js"` or `"test"`?
   - Is `@wordpress/scripts` listed in `devDependencies`?
   - Is `vitest` or `vite` listed in `devDependencies`?
2. Inspect lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`):
   - Check if `jest` or `vitest` dependencies are resolved.

### Step 2: Adaptive Decision Tree

```text
Is there an existing working test suite?
├── YES ──> Preserve the existing runner! Do not perform a forced migration.
└── NO (Greenfield setup)
    ├── Does the plugin use Vite or modern ESM tooling?
    │   └── YES ──> Choose Vitest Profile (vitest + @vitejs/plugin-react).
    └── Does the plugin build with standard @wordpress/scripts (Webpack)?
        └── YES ──> Choose Jest Profile (wp-scripts test-unit-js).
```

---

## 🏎️ Profile Differences Summary

| Dimension | Jest Profile | Vitest Profile |
|---|---|---|
| **CLI Runner** | `wp-scripts test-unit-js` | `vitest run` (CI) / `vitest` (watch) |
| **Config File** | `jest.config.cjs` (extends `@wordpress/jest-preset-default`) | `vitest.config.mjs` (uses `@vitejs/plugin-react`) |
| **Setup File** | `tests/unit-js/setup.js` | `tests/unit-js/setup.js` |
| **Mocking API** | `jest.fn()`, `jest.mock()` | `vi.fn()`, `vi.mock()` |
| **JSX Transform** | Handled via Babel preset in `@wordpress/scripts` | Handled via `@vitejs/plugin-react` |
| **Execution Speed** | Moderate (~3–6s cold start) | Ultra-fast (<1.5s cold start) |
