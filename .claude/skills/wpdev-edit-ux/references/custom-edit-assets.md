# Custom admin assets on edit pages

**Source pattern:** `Edit_Admin_Page::register_scripts()` calls `parent::register_scripts()` then enqueues page assets (`@framework/modules/admin-page-builder/src/admin/class-edit-admin-page.php`).

**Write target:** host plugin assets + host edit page class.

## Enqueue from the edit page

```php
public function register_scripts() {
	parent::register_scripts();

	wp_enqueue_style(
		'my-host-edit',
		plugins_url( 'assets/css/admin-edit.css', MY_PLUGIN_FILE ),
		array(),
		'1.0.0'
	);

	wp_enqueue_script(
		'my-host-edit',
		plugins_url( 'assets/js/admin-edit.js', MY_PLUGIN_FILE ),
		array( 'jquery' ),
		'1.0.0',
		true
	);
}
```

Use the host plugin’s main file constant (or `__FILE__` from a known host path). **Never** enqueue host assets through `wpdev_path()` / `wpdev_url()` — those resolve under `WPDEV_PLUGIN_DIR` only.

## Declare every runtime the script uses

Dependency array must match what the JS actually calls — `jquery` alone is a recurring
regression source:

| Script uses | Required dependency |
|-------------|---------------------|
| `new Vue(...)` / `v-show` templates | `wpdev-vue` |
| `window.wpdev_ajax.nonce` (WPDev ajax handlers) | `wpdev-ajax` |
| `wpdev_block_ui()` | `wpdev-block-ui` |
| `Swal.fire()` | `wpdev-sweet-alert` |

A Vue-mounting script with jquery-only deps can execute before Vue loads: the app
never mounts and any ajax-driven widget freezes on its loading placeholder. See
`wpdev-modal-forms/references/ajax-stuck-loading.md`.

## Page-scoped CSS hooks

Use `admin_body_class` so styles only affect this screen:

```php
add_filter( 'admin_body_class', function ( $classes ) {
	// Only when this page is current (use your page $id check).
	$classes .= ' my-host-edit-screen';
	return $classes;
} );
```

Some base pages already add body classes; prefer page-local filters from the edit class constructor or an existing hook used by adjacent host pages.

## Setup unfinished / Vue tabs note

When WPDev network setup is unfinished, `WPDev::init()` skips `Scripts::get_instance()`. `Edit_Admin_Page` / `List_Admin_Page` call `Scripts::ensure_defaults_registered()` before enqueueing `wpdev-vue-apps`, so host plugins must **not** re-implement that guard — call `parent::register_scripts()` only.

See [consumer-plugin-layout.md](../../wpdev-panel-builder/references/consumer-plugin-layout.md) § setup unfinished fallback.

## Rules

- Host path helpers only (`plugins_url`, `plugin_dir_path`).
- Call `parent::register_scripts()` first.
- Pair with [repeater-fields.md](repeater-fields.md) when assets drive conditional repeater rows.
