# Toolchain Compatibility Matrix

Compatibility verification across Node, React, WordPress Scripts, and test runners:

| Component | Verified Stable Version | Notes & Constraints |
|---|---|---|
| **Node.js** | `>= 20.0.0` (LTS) | Active LTS versions (Node 20 / 22) recommended. |
| **`@wordpress/scripts`** | `^35.0.0` | Default stable release; relies on Jest 30.5 for `test-unit-js`. |
| **`@wordpress/e2e-test-utils-playwright`** | `^2.0.0` or `^1.41.0` | Standard Playwright adapter for WordPress E2E. |
| **`react` & `react-dom`** | `^18.3.0` / `^19.0.0` | WordPress 6.6+ supports React 18/19. Test with matched ReactDOM. |
| **`@testing-library/react`** | `^16.0.0` | Compatible with React 18 and 19. |
| **`vitest`** | `^3.0.0` / `^5.0.0` | Standalone runner for modern ESM projects. |
| **`@vitejs/plugin-react`** | `^4.3.0` | Provides JSX transformation in Vitest without Babel overhead. |
| **`jsdom`** | `^25.0.0` | DOM simulation environment for React component tests. |
