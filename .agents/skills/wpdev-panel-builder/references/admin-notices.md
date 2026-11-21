# Admin notices (typed colors + action buttons)

**Facade:** `wpdev_add_admin_notice()`  
**Source:** `@framework/modules/core/src/functions/admin-notices.php`  
**Class:** `@framework/modules/core/src/class-admin-notices.php`  
**Template:** `@framework/views/admin-notices.php`  
**API doc:** `@framework/modules/core/API_DOC.md` § `wpdev_add_admin_notice`

**Write target:** host plugin (or optional `@examples` consumer). Prefer the facade over
`wpdev()->notices->add()` and over raw `admin_notices` HTML.

## Signature

```php
wpdev_add_admin_notice(
	string $message,
	string $type = 'info',           // info | warning | error | success
	string $panel = 'admin',         // admin | network-admin | user
	string|false $dismissible_key = false,
	array $actions = array()
): bool
```

Notices render on `in_admin_header` for the matching panel. Queue them early enough
(e.g. `load-{hook}.php`, `admin_init`, or your page `page_loaded()` / manager `init`).

## Types → colors

| `$type` | WP class | Typical use |
|---------|----------|-------------|
| `info` | `notice-info` | Tips, recommendations (blue) |
| `warning` | `notice-warning` | Compatibility / soft problems |
| `error` | `notice-error` | Validation / hard failures |
| `success` | `notice-success` | Activation / save OK |

## Action buttons

Each `$actions[]` item:

| Key | Required | Notes |
|-----|----------|-------|
| `title` | yes | Label (HTML ok for `&rarr;`) |
| `url` | yes | Absolute or admin URL |
| `style` | no | `primary` (filled) or `secondary` (default outline) |
| `primary` | no | Bool shorthand for `style => primary` |
| `target` | no | e.g. `_blank` (adds `rel="noopener noreferrer"`) |
| `class` | no | Extra CSS classes on the `<a>` |

```php
wpdev_add_admin_notice(
	__( 'Manage network sites from WPDev → Sites.', 'textdomain' ),
	'info',
	'network-admin',
	'my-host-sites-tip',
	array(
		array(
			'title' => __( 'Go to WPDev Sites →', 'textdomain' ),
			'url'   => wpdev_network_admin_url( 'wpdev-sites' ),
			'style' => 'primary',
		),
		array(
			'title'  => __( 'Docs', 'textdomain' ),
			'url'    => 'https://example.com/docs',
			'target' => '_blank',
			'style'  => 'secondary',
			'class'  => 'my-host-notice-docs',
		),
	)
);
```

Gold-standard consumer: `@examples/sites/src/managers/class-site-manager.php`
(`add_notices_to_default_site_page` on `load-sites.php`).

## Dismissible notices

Pass a **stable** `$dismissible_key` (slug). Dismissal is stored in user meta
`wpdev_dismissed_admin_notices` via ajax `wpdev_dismiss_admin_notice`.

Do not reuse keys across unrelated messages.

## Edit-page validation

On `handle_save()` failures, queue an `error` notice for the page panel and return
`false` — see [handle-save-validation.md](../../wpdev-edit-ux/references/handle-save-validation.md).

```php
wpdev_add_admin_notice( $message, 'error', 'admin' ); // or network-admin
return false;
```

## Anti-patterns

| Never | Do instead |
|-------|------------|
| Echo raw `<div class="notice">` in WPDev chrome | `wpdev_add_admin_notice()` |
| Use `_ajax_nonce` / custom dismiss handlers | Built-in dismiss + key |
| Queue with wrong `$panel` | Match `is_network_admin()` / site / user |
| Hard-code button markup | Pass `$actions` with `style` / `target` / `class` |
