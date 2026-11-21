# Admin and front-end patterns

## Authentication

Global setup (template) calls `requestUtils.setupRest()` and writes admin cookies to `artifacts/storage-states/admin.json`. Specs using the default project are **already logged in as admin**.

To test another role, either:

1. Call `await requestUtils.login( { username, password } )` in a `beforeEach`, or
2. Add a second Playwright project with its own `storageState` path and global-setup variant.

Default wp-env credentials: **`admin` / `password`**.

## wp-admin flows

Use `admin.visitAdminPage( path, query )` — handles login redirect and `wp-admin` base:

```javascript
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test( 'plugins screen lists active plugin', async ( { admin, page } ) => {
	await admin.visitAdminPage( '/plugins.php' );
	await expect(
		page.getByRole( 'heading', { name: 'Plugins', level: 1 } )
	).toBeVisible();
} );

test( 'plugin settings page saves', async ( { admin, page } ) => {
	await admin.visitAdminPage( '/admin.php', 'my-plugin-settings' );
	await page.getByLabel( 'Enable feature' ).check();
	await page.getByRole( 'button', { name: 'Save Changes' } ).click();
	await expect( page.getByText( 'Settings saved' ) ).toBeVisible();
} );
```

### Common admin paths

| Screen | `visitAdminPage` args |
|--------|------------------------|
| Dashboard | `'/'` |
| Posts list | `'/edit.php'` |
| Plugins | `'/plugins.php'` |
| Settings → General | `'/options-general.php'` |
| Custom menu page | `'/admin.php', 'page-slug'` |

### Block editor (admin)

When the feature lives in the editor:

```javascript
test( 'publish post from editor', async ( { admin, editor, page } ) => {
	const title = 'Editor E2E title';
	await admin.createNewPost( { title } );
	await editor.publishPost();
	await admin.visitAdminPage( '/edit.php' );
	await expect( page.getByRole( 'link', { name: new RegExp( title ) } ) ).toBeVisible();
} );
```

See core [`edit-posts.test.js`](https://github.com/WordPress/wordpress-develop/blob/trunk/tests/e2e/specs/edit-posts.test.js) for iframe/canvas patterns.

### Admin AJAX / SPA

Prefer asserting visible outcomes after click. If the plugin exposes REST, seed and verify via REST plus a minimal UI smoke test.

## Front-end flows

Use `page` against the **public** site (same origin as `WP_BASE_URL`, default test site `:8889`).

```javascript
test( 'home loads', async ( { page } ) => {
	await page.goto( '/' );
	await expect( page ).toHaveTitle( /WordPress/i );
} );

test( 'single post by permalink', async ( { requestUtils, page } ) => {
	const title = 'Front-end permalink test';
	const post = await requestUtils.createPost( { title, status: 'publish' } );

	await page.goto( `/?p=${ post.id }` );
	await expect(
		page.getByRole( 'heading', { name: title, level: 1 } )
	).toBeVisible();
} );
```

With pretty permalinks enabled in `.wp-env.json`, prefer slug URLs once you know the slug:

```javascript
await page.goto( '/hello-world/' );
```

### Logged-out vs logged-in front

Default project is admin-authenticated. For logged-out front-end only:

```javascript
test.use( { storageState: { cookies: [], origins: [] } } );

test( 'visitor sees public page', async ( { page } ) => {
	await page.goto( '/' );
	// ...
} );
```

### Shortcodes and blocks on front

1. Create post with shortcode/block via `requestUtils.createPost( { content: '[my_shortcode]' } )`.
2. `page.goto` to permalink.
3. Assert rendered output with role/text locators.

## Splitting suites

Organize by surface:

```
tests/e2e/specs/
├── admin/
│   ├── dashboard.spec.js
│   └── settings.spec.js
└── frontend/
    ├── home.spec.js
    └── shortcode.spec.js
```

Keep admin specs that mutate settings separate from front-end read-only smoke tests when parallelization is added later.

## Plugin-specific: wpdev-access-manager style

For plugins with custom admin menus under WPDev shell:

- Find the menu slug from `admin.php?page=…` in the plugin registrar.
- Use `visitAdminPage( '/admin.php', 'wpdev-am' )` (replace with actual slug).
- For personal menu eye UI on `#adminmenu`, use headed mode — RTL layout may need `getByRole` on the toggle control your plugin documents.
