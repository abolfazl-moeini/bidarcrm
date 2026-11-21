# Settings sections (wpdev-settings shell)

Two registration styles feed the same polished settings UI.

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/admin-setting-page-defaults/src/sections/class-api.php:33-51`

```php
wpdev_register_settings_section( 'api', array(
    'title' => __( 'API & Webhooks', 'wpdev' ),
    'desc'  => __( 'API & Webhooks', 'wpdev' ),
    'icon'  => 'dashicons-wpdev-paper-plane',
    'order' => 95,
) );

wpdev_register_settings_field( 'api', 'enable_api', array(
    'title'   => __( 'Enable API', 'wpdev' ),
    'type'    => 'toggle',
    'default' => 1,
) );

wpdev_register_settings_field( 'api', 'api_key', array(
    'title'   => __( 'API Key', 'wpdev' ),
    'type'    => 'text',
    'default' => '',
    'require' => array( 'enable_api' => 1 ), // hide until toggle is on
) );
```

## Facades

```php
wpdev_ensure_settings(); // optional; facades call this
wpdev_register_settings_section( $section_slug, $atts, $replace = true );
wpdev_register_settings_field( $section_slug, $field_slug, $atts );
```

Source: `@framework/modules/settings-panel-builder/src/functions/settings.php`.

Common section attributes: `title`, `desc`, `icon`, `order`, `capability`. Defaults applied in `Settings::add_section()` include `icon`, `order`, `capability` — extra keys are preserved.

### Host section on the shared shell (addon-style)

```php
function my_plugin_register_settings_sections() {
	static $scheduled = false;
	static $registered = false;

	if ( ! did_action( 'init' ) ) {
		if ( ! $scheduled ) {
			add_action( 'init', 'my_plugin_register_settings_sections', 5 );
			$scheduled = true;
		}
		return;
	}

	if ( $registered ) {
		return;
	}
	$registered = true;

	wpdev_register_settings_section( 'my-plugin-tools', array(
		'title' => __( 'My Plugin Tools', 'my-plugin' ),
		'desc'  => __( 'Host options on wpdev-settings', 'my-plugin' ),
		'icon'  => 'dashicons-wpdev-download',
		'order' => 120,
		'addon' => true, // presentation: groups under “Add-ons” in left-nav
	) );

	wpdev_register_settings_field( 'my-plugin-tools', 'enable_feature', array(
		'title'   => __( 'Enable feature', 'my-plugin' ),
		'type'    => 'toggle',
		'default' => 1,
		// Omit capability: the default manage_network maps to manage_options on single-site.
	) );
}
add_action( 'wpdev_settings_register_default_sections', 'my_plugin_register_settings_sections', 20 );
add_action( 'wpdev_load', 'my_plugin_register_settings_sections', 30 );
```

**`addon => true`:** functional in `views/base/settings.php` (sections with the flag render under an **Add-ons** heading). It is **not** a first-class validated schema key and **not** a security flag. Re-verify on the installed framework version. Deeper notes: [advanced-capabilities-and-settings.md](../../wpdev-advanced-panels/references/advanced-capabilities-and-settings.md).

**Section `capability` and cascading:** When registered with a custom capability, `Settings::add_section()` automatically cascades that capability to all fields in the section that do not specify an explicit capability override. In `Settings_Admin_Page::default_view()` and `Settings_Save::resolve()`, users with the section capability (or the owning page capability) can view and save these fields without requiring `manage_options`. Explicit field-level capability declarations (e.g. `'capability' => 'manage_options'` on sensitive fields) are strictly respected to preserve the principle of least privilege. For custom save authorizations or custom settings actions, implement a host-owned settings page with an overridden/custom save handler enforcing the **Two-Gate Defense-in-Depth Model** (Gate 1: native WP capability; Gate 2: AccessManager domain policy via `wpdev_can()`); page access alone does not authorize saving.

The wrapper defers host-domain `__()` until `init`; this is required on WP 6.7+
(see i18n timing below).

## Rules

### WP 6.7+ i18n timing (host text domains)

`wpdev_load` and `wpdev_settings_register_default_sections` fire **inside** `plugins_loaded` — before `init`. Calling `__( …, 'my-plugin' )` there triggers `_load_textdomain_just_in_time` notices.

**Do this:**

```php
function my_plugin_register_settings_sections() {
	if ( ! did_action( 'init' ) ) {
		add_action( 'init', 'my_plugin_register_settings_sections', 5 );
		return;
	}
	wpdev_register_settings_section( 'my_general', array(
		'title' => __( 'General', 'my-plugin' ),
		// …
	) );
}
add_action( 'wpdev_settings_register_default_sections', 'my_plugin_register_settings_sections', 20 );
add_action( 'wpdev_load', 'my_plugin_register_settings_sections', 30 );
```

Also load the host textdomain on `init` priority `1` (before section registration at `5`).

### Section icons (left-nav)

- Prefer **`dashicons-wpdev-*`** (framework icon font). Default when omitted: `dashicons-wpdev-cog`.
- Left-nav renders the class as-is via `wpdev_admin_section_icon_class()`.
- WordPress core glyphs (`dashicons-megaphone`, …) work only because the helper prepends the base `dashicons` class — still prefer `dashicons-wpdev-*` for visual consistency.
- Do **not** confuse with WP Admin **menu** icons (`wpdev_register_menu_top` / `$menu_icon`), which use core Dashicons.

### Field UX

- **Conditionals:** `'require' => array( 'other_field' => 1 )` → Vue `v-show` on the wrapper. Toggle model values are booleans (`true`/`false`); `require()` uses loose `==`, so `1` still matches.
- **Colors on Settings chrome** (`admin-pages/fields`): use `type => 'color-picker'` (or `color`, which aliases to the same view). Narrow with `wrapper_classes` e.g. `sm:wpdev-w-1/2 lg:wpdev-w-1/3`.
- **Repeaters:** type `repeater` posts column arrays (`field[]`), not one setting key — assemble in `wpdev_pre_save_settings` (see [repeater-fields.md](../../wpdev-edit-ux/references/repeater-fields.md) § settings). Prefer unique subfield slugs when multiple repeaters exist.
- Framework shell: `Settings_Admin_Page` → `admin.php?page=wpdev-settings` with `?tab=` navigation.
- Prefer register on `wpdev_load` / `wpdev_settings_register_default_sections`.
- Field default capability automatically inherits from the section or owning page capability. On **single-site**, `Settings_Admin_Page` also accepts `manage_options` so site admins can see/save fields. Subclasses with custom capabilities on `$supported_panels['admin_menu']` automatically propagate that permission to view and save section fields.

## Host-owned settings page (brand submenu)

Reuse the same chrome by subclassing `Settings_Admin_Page` with a unique `$id` and brand `$parent` (see [custom-top-level.md](custom-top-level.md)). Override `get_sections()` to return only your section slugs.

**`register_widgets()`:** `Settings_Admin_Page::register_widgets()` first registers the section body metabox (`wpdev-wizard-body` via `Wizard_Admin_Page`), then adds marketing side panels. To skip those panels, **do not** leave `register_widgets()` empty — re-register only the body metabox (same `add_meta_box( 'wpdev-wizard-body', … )` pattern as `Wizard_Admin_Page`). An empty override leaves the left-nav tabs visible with no section content.

```php
class My_Theme_Settings_Page extends \WPDevFramework\Admin_Pages\Settings_Admin_Page {
	protected $id     = 'my-theme-settings';
	protected $type   = 'submenu';
	protected $parent = 'my-brand'; // WPDEV_BRAND_MENU_SLUG
	protected $supported_panels = array( 'admin_menu' => 'manage_options' );

	public function register_scripts() {
		// Prefer relying on parent (framework calls ensure_defaults_registered).
		parent::register_scripts();
	}

	public function get_sections() {
		// Ensure sections/fields registered, then filter to your slugs.
		return array_intersect_key(
			\WPDevFramework\Settings::get_instance()->get_sections(),
			array_flip( array( 'my_general', 'my_hero' ) )
		);
	}

	public function register_widgets() {
		// Body only — skip Settings_Admin_Page marketing side panels.
		$screen = get_current_screen();
		if ( ! $screen || ( is_array( $this->current_section ) && ! empty( $this->current_section['separator'] ) ) ) {
			return;
		}
		add_meta_box(
			'wpdev-wizard-body',
			is_array( $this->current_section )
				? (string) ( $this->current_section['title'] ?? __( 'Section', 'my-plugin' ) )
				: __( 'Section', 'my-plugin' ),
			array( $this, 'output_default_widget_body' ),
			$screen->id,
			'normal',
			null
		);
	}
}
```

## Setup unfinished

When `Requirements::met()` fails (or on WPDev &lt; 2.9.1 with `wpdev_setup_finished` false), `wpdev_load` may never fire and `wpdev()->settings` may be unset:

1. Facades call `wpdev_ensure_settings()` so `add_section` / `add_field` still run (not registry-only tabs).
2. `Settings_Admin_Page::register_scripts()` calls `Scripts::ensure_defaults_registered()` so Vue mounts and the settings loader unblock (`remove_block_ui`) runs.
3. Host: instantiate the page on `plugins_loaded` fallback if `wpdev_admin_pages` never fired — but **register sections later** (page load / `get_sections`), not on early `plugins_loaded`, if defaults call WooCommerce/permalink APIs.

See also [consumer-plugin-layout.md](../../wpdev-panel-builder/references/consumer-plugin-layout.md) § setup unfinished fallback.

## Custom `default_view()` (no Form chrome)

`views/base/settings.php` always runs `wpdev_block_ui('#wpdev-wizard-body')`. Standard sections clear it because `Form` sets `data-on-load="remove_block_ui"` and `vue-apps.js` calls that from `mounted()`.

If you override `default_view()` with a **custom body** (own Vue app, HTML builder, etc.) and do **not** render a Form with `data-on-load`:

1. Framework fallback: when `#wpdev-wizard-body` has no `[data-on-load]`, settings.php calls `remove_block_ui()` immediately so the spinner does not stick forever.
2. Host custom Vue apps should still call `remove_block_ui()` (and usually `wpdev_on_load()` / `wubox.refresh()`) from their own `mounted()` — same contract as `vue-apps.js`, and required when a sibling Form with `data-on-load` is present but your panel is separate.

```js
mounted: function () {
  if (typeof window.remove_block_ui === 'function') {
    window.remove_block_ui();
  }
  if (typeof window.wpdev_on_load === 'function') {
    window.wpdev_on_load();
  }
  if (window.wubox && typeof window.wubox.refresh === 'function') {
    window.wubox.refresh();
  }
}
```
