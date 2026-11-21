# Production top-level / brand menu shell

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

`Top_Level_Admin_Page` (`admin.php?page=wpdev`) defines production shell quality for the **framework** dashboard:

- Real `$menu_icon` dashicon (not default)
- `?tab=` navigation with filter bar
- Widgets via `wpdev_register_dashboard_widget()` rendered as WP metaboxes (position/priority grid)
- Never a single flat unstyled page

Gold standard: `@examples/dashboard/src/admin/class-top-level-admin-page.php`.

## Quality bar

| Element | Requirement |
|---------|-------------|
| Menu icon | Explicit dashicon on top-level page |
| Tabs | Tab navigation for multi-section dashboards |
| Widgets | Registered widgets with position/priority |
| Capabilities | Per-widget and per-page capability gates |

## Shared brand top-level (multi-plugin products)

When several host plugins need one sidebar root (product brand):

1. Define `WPDEV_BRAND_MENU_SLUG` early (same slug in every host), **or** filter `wpdev_brand_menu_slug` to the same value as the feature page `$parent`. This is required: if the slug stays empty, `Base_Admin_Page` / repair skip brand materialization and children can be reachable via URL while missing from the sidebar.
2. Register feature pages as **submenus** with `$parent` / `wpdev_register_menu_child( $brand, … )`.
3. Framework creates the top-level on-the-fly; title defaults to **site name** (`wpdev_brand_menu_title`). For a product brand label (e.g. “WPDev Woo”), always filter the title — otherwise the sidebar shows the wp-env site title.
4. Optional: `wpdev_brand_menu_args` (icon, position, **`capability`** — default `manage_options`; Woo hosts often set `manage_woocommerce`), `wpdev_brand_menu_default_url`.
5. Add `wpdev_register_plugin_settings_link()` for plugins.php — call it on **`init`** (or leave `$label` empty so the framework translates at display time). Do **not** pass `__( 'Settings', 'my-plugin' )` from `plugins_loaded` (WP 6.7 JIT notice).

For a **settings UI with tabs** under the brand (not one submenu per section), subclass `Settings_Admin_Page` with `$parent =` brand slug and filter `get_sections()` — see [settings-sections.md](settings-sections.md) § Host-owned settings page.

Do **not** hardcode product names into the framework. Do **not** call `wpdev_ensure_brand_menu()` for unrelated parents (e.g. `wpdev`).

### Brand parent link resiliency (self-healing)

WordPress links a top-level menu to its **first submenu entry**. If the first
child registered before the brand top-level existed (cross-plugin load order) it
has no auto self-entry and no resolvable page hook, so WP emits a raw slug href
like `wp-admin/<child>` that **404s**. The framework guards this automatically:

1. `wpdev_ensure_brand_menu()` materializes the WordPress top-level even when
   Menu_Registry already has metadata — children must not register under the
   orphan `admin_page_*` hook (which later fails `user_can_access_admin_page`
   / menu link generation once the parent appears).
2. A late `admin_menu` pass repairs orphan hooks
   (`wpdev_repair_brand_submenu_page_hooks`) then promotes the first openable
   child (`wpdev_promote_openable_brand_child`, `PHP_INT_MAX`) only when the
   current first child is broken.
3. `wpdev_render_brand_menu_page` drops self-referential (loop) or dead-child
   `wpdev_brand_menu_default_url` values and falls back to the first openable
   child.

**Never** point `wpdev_brand_menu_default_url` at the brand slug itself
(`admin.php?page=<brand>`) — it loops; target a real child page.

```php
define( 'WPDEV_BRAND_MENU_SLUG', 'my-brand' );

add_filter( 'wpdev_brand_menu_title', static function () {
	return __( 'My Brand', 'my-plugin' );
} );

add_filter( 'wpdev_brand_menu_args', static function ( $args ) {
	$args['capability'] = 'manage_woocommerce'; // default is manage_options
	return $args;
} );

wpdev_register_menu_child( 'my-brand', 'my-feature', array(
	'title'      => __( 'My Feature', 'my-plugin' ),
	'capability' => 'manage_woocommerce',
	'callback'   => 'my_render',
) );

// Prefer init so host-domain labels are safe under WP 6.7+.
add_action( 'init', static function () {
	wpdev_register_plugin_settings_link(
		plugin_basename( MY_PLUGIN_FILE ),
		admin_url( 'admin.php?page=my-feature' ),
		__( 'Settings', 'my-plugin' )
	);
}, 5 );
```

Verify: `@framework/modules/menu-builder/API_DOC.md`.

## Custom solitary top-level (single plugin)

```php
wpdev_register_menu_top( 'my-plugin', array(
    'title'      => __( 'My Plugin', 'wpdev' ),
    'capability' => 'manage_options',
    'callback'   => 'my_render_dashboard',
    'icon'       => 'dashicons-admin-generic',
) );
```
