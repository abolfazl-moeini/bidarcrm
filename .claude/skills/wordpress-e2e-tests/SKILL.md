---
name: wordpress-e2e-tests
description: >-
  Scaffolds and writes WordPress E2E browser tests with Playwright,
  @wordpress/e2e-test-utils-playwright, wp-env, and @wordpress/scripts
  test-playwright. Use for real-browser wp-admin and front-end flows,
  headed/UI debugging, RequestUtils REST setup, admin and editor fixtures,
  or adding tests/e2e to a plugin or theme.
---

# WordPress E2E Tests

End-to-end guidance for WordPress plugins and themes using the **official Playwright stack**. Tests run in a **real browser** (headless, headed, or Playwright UI mode) against wp-admin and the public site.

**Complements:** [wordpress-plugin-unit-tests](../wordpress-plugin-unit-tests/SKILL.md) (PHPUnit unit tests). E2E covers integration and UI paths unit tests cannot reach.

**Skill root:** `{skill-root}` = Path to the installed `wordpress-e2e-tests` skill (e.g. `~/.agents/skills/wordpress-e2e-tests` or local path).

**Templates:** copy from `[assets/templates/](assets/templates/)` into the **plugin or theme project root** (not into the skill folder).

## Supported toolchain (locked)


| Component     | Version / source                             | Note                                                  |
| ------------- | -------------------------------------------- | ----------------------------------------------------- |
| Playwright    | `^1.58` (match `@wordpress/scripts`)         | `npx playwright install --with-deps` once             |
| Utils         | `@wordpress/e2e-test-utils-playwright ^1.41` | Import `{ test, expect }` from here only              |
| Runner        | `wp-scripts test-playwright`                 | Not raw `playwright test` unless customizing          |
| Local WP      | `@wordpress/env` + `.wp-env.json`            | Requires Docker                                       |
| Specs         | `tests/e2e/**/*.spec.js`                     | Use `.ts` only if the project already uses TypeScript |
| Test site URL | `http://localhost:8889`                      | wp-env **tests** instance (port 8888 = dev)           |
| Default creds | `admin` / `password`                         | Override with `WP_USERNAME` / `WP_PASSWORD`           |


**Out of scope:** Puppeteer, `@wordpress/e2e-test-utils` (legacy), Cypress, Codeception, WP Browser acceptance tests.

## DO / DON'T

**DO**

- Use `@wordpress/e2e-test-utils-playwright` for `test`, `expect`, and fixtures (`admin`, `editor`, `pageUtils`, `requestUtils`).
- Scaffold with `wp-env` + `.wp-env.json` mapping the plugin/theme as `"."`. Soft-dep on WPDev → `["../wpdev", "."]` (framework **first**). Extra `Requires Plugins:` deps (Woo zip, etc.) between framework and `"."`.
- Create/delete posts, users, and options via `requestUtils` (REST), not slow UI clicks.
- Use accessible locators: `page.getByRole()`, `getByLabel()`, `getByText()` — but scope when WP duplicates labels (see [wpdev-and-admin-ui.md](references/wpdev-and-admin-ui.md)).
- Group reusable page flows in **Page Object Model** classes under `tests/e2e/pages/` (see canonical template `assets/templates/tests/e2e/pages/admin-settings.page.js`).
- For WPDev wubox bulk/modals, target `#WUB_ajaxContent` (not iframe); toggle via `label[for=…]`.
- Run interactively when debugging: `npm run test:e2e -- --ui` or `--headed`.
- Set `workers: 1` when sharing one wp-env instance (default WP config often does this).
- Enable pretty permalinks in wp-env when testing front-end URLs (see [scaffolding.md](references/scaffolding.md)).
- Use `fill()` as the primary form input interaction; reserve `pressSequentially` after `clear()` for specific keyboard-event-dependent inputs or documented state lag.
- After saving settings or posts, verify persistence by asserting stored values or reloading the page.

**DON'T**

- Don't import `test` from `@playwright/test` directly — use `@wordpress/e2e-test-utils-playwright`.
- Don't use `page.waitForTimeout()` or arbitrary sleep delays — rely on web-first assertions (`expect(locator).toBeVisible()`) and locator auto-waiting.
- Don't use `{ force: true }` on clicks or keystrokes — fix element occlusion or waiting states instead.
- Don't use `$`, `page.$()`, or ElementHandle-style selectors.
- Don't hardcode machine paths (`/Users/...`) in configs or tests.
- Don't run E2E against production — global setup may delete posts and reset preferences.
- Don't invent Cypress/Selenium scaffolding when this skill applies.
- Don't commit `.env` files with real credentials for remote sites.
- Don't use `@wordpress/e2e-test-utils` (Puppeteer-era package) in new projects.
- Don't mix bare `require()` with ESM `import` in `playwright.config.js` when `package.json` has `"type": "module"` — use `createRequire(import.meta.url)` (see templates).
- Don't assert a success toast alone as proof of persistence — reload the page or verify via REST/DOM to confirm changes actually persisted.



## wp-starter-kit projects

If the plugin was scaffolded with `@wpdev/create-wp-project`, prefer the kit feature — do not hand-copy templates unless the project is outside the kit:

```bash
wpdev create my-plugin --e2e-test=playwright
wpdev add e2eTest --variant playwright   # existing project; bare add defaults to none
wpdev remove e2eTest
```

Canonical scaffolds: `packages/create-wp-project/src/generators/templates/e2e/`.  
Kit playbook: `wp-starter-kit/skills/wordpress-e2e-tests/`.

`refreshGlue` (after add/remove) must only touch feature glue (`package.json`, composer patches, `tsconfig`, `wpdev.json`, CI) — not bootstrap PHP / README / `packages/*`. If an older kit rewrote those files, restore them from git and keep the e2e artifacts.

## Greenfield procedure

Follow in order. Do not skip verification gates.

1. **Prerequisites** — Docker running; Node.js LTS; project is a WordPress plugin or theme with a root `package.json` (create one if missing). → [scaffolding.md](references/scaffolding.md)
2. **Merge npm deps and scripts** — from `[assets/templates/package.json.partial](assets/templates/package.json.partial)`:
  - `"wp-env": "wp-env"`
  - `"test:e2e": "wp-scripts test-playwright"`
  - devDependencies: `@wordpress/scripts`, `@wordpress/env`, `@wordpress/e2e-test-utils-playwright`, `@playwright/test`
3. `npm install` then `npx playwright install --with-deps`
4. **Copy** `.wp-env.json` from templates; set `"plugins": [ "." ]` (or `"themes": [ "." ]` for themes). → [scaffolding.md](references/scaffolding.md)
5. **Copy Playwright files** into the project (see `[assets/templates/README.md](assets/templates/README.md)`):
  - `playwright.config.js` → project root
  - `tests/e2e/` tree → project `tests/e2e/`
6. **Start environment:** `npx wp-env start`
7. **Verify scaffold:**

```bash
npx wp-env run tests-cli wp core is-installed
npm run test:e2e
```

Expect smoke specs to **pass**. If "No tests found", check `testDir` in `playwright.config.js` and spec paths.

1. **Rename placeholders** in smoke specs (plugin name on Plugins screen, settings page slug).
2. **Write feature specs** — admin flows in [admin-and-frontend.md](references/admin-and-frontend.md); follow [best-practices.md](references/best-practices.md).



### Run modes


| Goal                      | Command                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| CI / headless             | `npm run test:e2e`                                                                                       |
| Watch + time-travel debug | `npm run test:e2e -- --ui`                                                                               |
| Visible browser           | `npm run test:e2e -- --headed`                                                                           |
| Single file               | `npm run test:e2e -- tests/e2e/specs/admin-smoke.spec.js`                                                |
| Existing Docker site      | Set `WP_BASE_URL`, skip wp-env webServer → [existing-environment.md](references/existing-environment.md) |




## Minimal admin spec

```javascript
/**
 * WordPress dependencies
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test( 'dashboard loads', async ( { admin, page } ) => {
	await admin.visitAdminPage( '/' );
	await expect(
		page.getByRole( 'heading', { name: 'Dashboard' } )
	).toBeVisible();
} );
```



## Minimal front-end spec (REST setup + browser assert)

```javascript
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test( 'published post appears on the front end', async ( { requestUtils, page } ) => {
	const title = 'E2E front-end post';
	await requestUtils.createPost( { title, status: 'publish' } );

	await page.goto( '/' );
	await expect( page.getByRole( 'heading', { name: title, level: 1 } ) ).toBeVisible();
} );
```



## Safety

- Default global setup calls `deleteAllPosts()`, `deleteAllBlocks()`, `resetPreferences()` — **destructive on the target site**.
- Never point `WP_BASE_URL` at production.
- Use a dedicated test instance (wp-env test site on `:8889` or an isolated Docker stack).



## When stuck


| Symptom                                                    | Fix                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Port 8888/8889 in use                                      | Set `WP_ENV_PORT` / `WP_ENV_TESTS_PORT` / `WP_BASE_URL` (see [wpdev-and-admin-ui.md](references/wpdev-and-admin-ui.md)). Template `playwright.config.js` skips `webServer` when `WP_BASE_URL` is set so a second wp-env is not started on the defaults. |
| `wpdev add e2eTest` rewrote plugin PHP / README / composer | Fixed in kit `refreshGlue` (glue-only). If still on an older kit: `git checkout --` the damaged files, keep `.wp-env.json` / `playwright.config.js` / `tests/e2e/**`. Prefer kit ≥ the refreshGlue allowlist fix.                                       |
| Front-end smoke fails on home `h1` title                   | Block themes use `h2` on the blog index — open `post.link` and assert `h1` (see template `frontend-smoke.spec.js`).                                                                                                                                     |
| Login redirect loops                                       | Re-run tests (global-setup refreshes `storageState`); check creds                                                                                                                                                                                       |
| Flaky admin menu                                           | Use `admin.visitAdminPage()` instead of manual `page.goto` to wp-admin                                                                                                                                                                                  |
| Strict mode: duplicate “Add New” / menu label              | Scope `.page-title-action` or `toplevel_page_*`                                                                                                                                                                                                         |
| Required field empty after `fill()`                        | Clear + `pressSequentially` on TextControl                                                                                                                                                                                                              |
| Toast missing after save                                   | Assert redirect URL / list / REST — create often redirects                                                                                                                                                                                              |
| Soft-dep plugin inactive                                   | Put deps **before** `"."` in `.wp-env.json` (`../wpdev`, then Woo zip, then `.`)                                                                                                                                                                        |
| List status filter 404                                     | Navigate with `?status=` / view query instead of AJAX chip                                                                                                                                                                                              |
| Bulk modal empty / wrong source                            | Keep view args on the URL; modal body is `#WUB_ajaxContent` (not iframe)                                                                                                                                                                                |
| Toggle unchecked after click                               | Click `label[for=…]`, not only the checkbox                                                                                                                                                                                                             |
| Empty list: no `data-table-id`                             | Framework wraps empty state; seed data or upgrade WPDev if wrapper missing                                                                                                                                                                              |
| REST 403 in setup                                          | Ensure `requestUtils.setupRest()` ran in global-setup                                                                                                                                                                                                   |
| Block editor tests                                         | Use `editor` fixture; see core `edit-posts.test.js` patterns                                                                                                                                                                                            |




## Further reading

- [scaffolding.md](references/scaffolding.md) — wp-env, package.json, playwright.config, global-setup
- [best-practices.md](references/best-practices.md) — Gutenberg E2E rules (locators, POM, restify)
- [ci-and-isolation.md](references/ci-and-isolation.md) — E2E CI workers, sharding, and session isolation
- [wpdev-and-admin-ui.md](references/wpdev-and-admin-ui.md) — WPDev soft-dep, React TextControl, tabs, list filters
- [admin-and-frontend.md](references/admin-and-frontend.md) — fixtures and patterns per surface
- [existing-environment.md](references/existing-environment.md) — nikamooz / custom Docker without wp-env webServer

