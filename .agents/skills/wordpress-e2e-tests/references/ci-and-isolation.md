# E2E CI Execution & Environment Isolation Guide

## 1. Single Worker vs Parallel Sharding

- **Default CI Topology:** When testing against a single local `@wordpress/env` instance, always set `workers: 1`. Multiple parallel workers against a shared WordPress database create data collision, race conditions, and session invalidation.
- **Parallel Sharding:** If parallelization is required:
  - Each shard must run an independent Docker stack with a dedicated database and port mapping (`WP_ENV_PORT`, `WP_ENV_TESTS_PORT`).
  - Point `WP_BASE_URL` to the specific shard instance:
    ```bash
    WP_BASE_URL=http://localhost:8889 npm run test:e2e
    ```

---

## 2. Authentication & Session Hygiene

- `global-setup.js` logs in once and caches the browser state in `artifacts/storage-states/admin.json`.
- **Session Re-validation:** If tests reset database state or modify options, the cached authentication state becomes invalid.
- Never commit `storage-states/` or `.env` credential files to Git.

---

## 3. Data Scoping & Teardown Invariants

- **Isolated Setup:** Create test data (posts, terms, users) using `requestUtils.rest()` with unique prefixes (e.g. `test-post-${Date.now()}`).
- **Surgical Teardown:** Only delete posts or entities created during the current test execution. Avoid destructive calls like `deleteAllPosts()` inside regular test files.

---

## 4. Failure Artifacts & Diagnostic Capture

Ensure `playwright.config.js` captures diagnostics on failure:
- `screenshot: 'only-on-failure'`
- `video: 'retain-on-failure'`
- `trace: 'retain-on-failure'` (ensures trace files are saved even with `retries: 0`).
