# E2E scaffolding (greenfield)

Copy files from `{skill-root}/assets/templates/` into the **plugin or theme root**.

## 1. package.json

Merge scripts and devDependencies from [`package.json.partial`](../assets/templates/package.json.partial):

```json
{
  "scripts": {
    "wp-env": "wp-env",
    "test:e2e": "wp-scripts test-playwright"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@wordpress/e2e-test-utils-playwright": "^1.41.0",
    "@wordpress/env": "^10.39.0",
    "@wordpress/scripts": "^30.0.0"
  }
}
```

Pin versions to match your project's `@wordpress/scripts` when one is already present (`npm ls @wordpress/scripts`).

Install:

```bash
npm install
npx playwright install --with-deps
```

## 2. `.wp-env.json` (plugin)

```json
{
  "$schema": "https://schemas.wp.org/trunk/wp-env.json",
  "plugins": [ "." ],
  "config": {
    "WP_DEBUG": true,
    "SCRIPT_DEBUG": true
  },
  "lifecycleScripts": {
    "afterStart": "for SERVICE in cli tests-cli; do wp-env run \"$SERVICE\" wp rewrite structure '/%postname%/' --hard; wp-env run \"$SERVICE\" wp rewrite flush --hard; done"
  }
}
```

For a **theme**, use `"themes": [ "." ]` and activate it in `afterStart` (see [WP Developer Blog May 2026](https://developer.wordpress.org/news/2026/05/getting-started-writing-wordpress-e2e-tests-with-playwright/)).

### Soft-dep on WPDev (`Requires Plugins: wpdev`)

Mount soft-deps **before** the consumer (activation order matters):

```json
{
  "plugins": ["../wpdev", "."]
}
```

Extra `Requires Plugins:` deps (WooCommerce, etc.) go **between** framework and consumer. Details: [wpdev-and-admin-ui.md](wpdev-and-admin-ui.md).

Expect `wpdev` as a sibling under `wp-content/plugins/`.

### Alternate ports

If `8888`/`8889` are busy:

```bash
WP_ENV_PORT=8898 WP_ENV_TESTS_PORT=8899 WP_BASE_URL=http://localhost:8899 npm run test:e2e
```

Start:

```bash
npx wp-env start
```

- Dev site: `http://localhost:8888`
- **Test site (Playwright default):** `http://localhost:8889`
- WP-CLI test instance: `npx wp-env run tests-cli wp …`

## 3. `playwright.config.js`

Place at project root. Extends WordPress defaults and points at `tests/e2e`.

Prefer copying [`assets/templates/playwright.config.js`](../assets/templates/playwright.config.js) verbatim — do not use bare `require()` at top level under `"type": "module"`.

The template:

- Starts `wp-env` via the `@wordpress/scripts` `webServer` when `WP_BASE_URL` is **unset**
- When `WP_BASE_URL` is set (port remaps or an existing site), clears `webServer` and uses that URL so Playwright does not fight for default ports `8888`/`8889`

```bash
# Already-running wp-env on alternate ports:
WP_ENV_PORT=8908 WP_ENV_TESTS_PORT=8909 WP_BASE_URL=http://localhost:8909 npm run test:e2e
```

Override details → [existing-environment.md](existing-environment.md).

## 4. `tests/e2e/config/global-setup.js`

Authenticates via REST, saves admin `storageState`, and resets test data before the suite. Template:

[`assets/templates/tests/e2e/config/global-setup.js`](../assets/templates/tests/e2e/config/global-setup.js)

Pattern matches [WordPress core](https://github.com/WordPress/wordpress-develop/blob/trunk/tests/e2e/config/global-setup.js).

## 5. Directory layout (in the plugin/theme)

```
your-plugin/
├── .wp-env.json
├── playwright.config.js
├── package.json
└── tests/
    └── e2e/
        ├── config/
        │   └── global-setup.js
        ├── pages/              # Page Object Models (add as needed)
        └── specs/
            ├── admin-smoke.spec.js
            └── frontend-smoke.spec.js
```

## 6. Verification checklist

```bash
docker info >/dev/null          # Docker available
npx wp-env start
npx wp-env run tests-cli wp plugin list --status=active
npm run test:e2e                # smoke specs pass
npm run test:e2e -- --ui        # optional: open Playwright UI
```

If `npm run test:e2e` reports "No tests found", confirm `testDir` and that spec files match `*.spec.js`.

## 7. CI (GitHub Actions sketch)

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```

Use `workers: 1` and a single wp-env instance. Cache Playwright browsers between runs when possible.
