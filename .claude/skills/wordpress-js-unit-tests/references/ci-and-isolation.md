# CI Execution & Test Isolation Guide

## 1. Single-Run Commands in CI
In continuous integration pipelines (GitHub Actions, GitLab CI), test commands must never enter interactive watch mode or hang waiting for user input:

- **Jest:**
  ```bash
  npm run test:unit:js -- --ci --maxWorkers=2
  ```
- **Vitest:**
  ```bash
  npm run test:unit:js
  # Or explicitly:
  npx vitest run --reporter=verbose
  ```

---

## 2. Resource Budgets & Worker Sizing

- **Memory Ceilings**: JSDOM environments leak memory when large DOM trees are retained across suites.
  - Set Node memory option if suites exceed 500 tests: `NODE_OPTIONS="--max-old-space-size=4096"`.
  - Ensure every DOM test implements a clean `afterEach` unmounting or removing root containers.
- **Worker Allocation**:
  - In CI virtual machines with 2 vCPUs, cap workers to 2 (`--maxWorkers=2`). Spawning unlimited workers on low-core machines causes thrashing and CPU starvation.

---

## 3. Test Isolation & Global Cleanup

- **Global Isolation**: Tests must never rely on side-effects left by prior tests.
- Always restore mocks and delete temporary `window` properties in `afterEach`:
  ```javascript
  afterEach(() => {
    delete window.myPluginSettings;
    delete window.wpApiSettings;
    // Jest:
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Or Vitest:
    // vi.clearAllMocks();
    // vi.restoreAllMocks();
  });
  ```
