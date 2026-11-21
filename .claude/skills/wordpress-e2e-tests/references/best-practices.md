# E2E best practices (WordPress / Gutenberg)

Sourced from the [Block Editor E2E handbook](https://developer.wordpress.org/block-editor/contributors/code/testing-overview/e2e/) and WordPress core `tests/e2e`.

## Locators and assertions

- **Forbid `$` and ElementHandle** — use Playwright locators only.
- Prefer **`getByRole`** with accessible name and level: `page.getByRole( 'heading', { name: 'Dashboard' } )`.
- **Assert before act** when order matters: `await expect( locator ).toBeVisible()` then click.
- Avoid CSS-only selectors tied to WordPress core markup that changes between releases; role + name is more stable.

## Restify setup (REST over UI)

Use `requestUtils` fixtures for data setup and teardown:

```javascript
test.beforeEach( async ( { requestUtils } ) => {
	await requestUtils.deleteAllPosts();
} );

test( 'example', async ( { requestUtils, page } ) => {
	await requestUtils.createPost( { title: 'Hello', status: 'publish' } );
	await page.goto( '/' );
	// assert front-end
} );
```

Use `requestUtils.rest()` / `requestUtils.batchRest()` for options, users, and custom REST routes. Add helpers to a project-specific wrapper only when the same REST call repeats across many specs.

Still add **one** UI test per critical settings screen if users must click to save — but do not create every post via the block editor when REST is enough.

## Page Object Model

For a plugin settings screen visited in many tests:

```javascript
// tests/e2e/pages/PluginSettingsPage.js
export class PluginSettingsPage {
	constructor( { admin, page } ) {
		this.admin = admin;
		this.page = page;
	}

	async open() {
		await this.admin.visitAdminPage( '/admin.php', 'your-plugin-slug' );
		await expect(
			this.page.getByRole( 'heading', { name: 'Your Plugin' } )
		).toBeVisible();
	}

	async save() {
		await this.page.getByRole( 'button', { name: 'Save Changes' } ).click();
	}
}
```

Use POM for **one screen's** actions. Do not build a global "WordPress utils" dumping ground — inline simple one-off helpers in the spec.

## Fixtures (from `@wordpress/e2e-test-utils-playwright`)

| Fixture | Use for |
|---------|---------|
| `admin` | `visitAdminPage()`, `createNewPost()`, menu navigation |
| `editor` | Block editor publish/save flows |
| `requestUtils` | REST create/delete, login, preferences |
| `pageUtils` | Keyboard shortcuts, drag, small page helpers |

Import `{ test, expect }` only from `@wordpress/e2e-test-utils-playwright` so fixtures are injected automatically.

## Flakiness

- No arbitrary `page.waitForTimeout()` — use `expect` auto-wait or `waitForURL`.
- Run with **`workers: 1`** against one wp-env test DB unless you isolate data per worker.
- Take **trace on first retry** (Playwright config option) for CI debugging.
- Screenshots and video: enabled in base `@wordpress/scripts` config artifacts path (`artifacts/`).

## Browser tags

Append `@firefox` or `@webkit` to a test title to run in additional browsers. Chromium always runs by default.

## RTL / i18n

When the site runs fa_IR or RTL admin:

- Set locale in wp-env config or `wp language core install fa`.
- Assert on **translated** strings or use `data-testid` attributes your plugin controls.
- Test admin menu layout separately for RTL if the plugin adds fixed-position UI.

## Security testing in E2E

- Verify subscribers cannot reach admin pages (`visitAdminPage` as lower role via separate storage state or `requestUtils.login`).
- Nonces and capabilities are better covered in PHPUnit; E2E confirms the UI hides or blocks unauthorized actions.

## What not to test in E2E

- Pure PHP business logic (unit tests).
- Every REST field combination (REST/unit tests).
- Third-party plugin interactions unless required for your feature.

## WPDev / React admin (common failures)

See [wpdev-and-admin-ui.md](wpdev-and-admin-ui.md) for full detail. Short list:

- Soft-dep plugins: `.wp-env.json` → `["../wpdev", "."]` (framework first).
- Controlled `TextControl`: prefer `pressSequentially` after clear — `fill()` alone may not update React state.
- After create+redirect, assert URL / list / REST — not a toast that never appears.
- WPDev settings tabs: `#tab-selector-{section}-link`, not bare `getByText`.
- Duplicate menu labels → scope with `.page-title-action` / `toplevel_page_*`.
- List status filters: prefer `visitAdminPage(…&status=…)` over AJAX chips in wp-env.
- Port clashes: `WP_ENV_PORT` / `WP_ENV_TESTS_PORT` / `WP_BASE_URL`.
