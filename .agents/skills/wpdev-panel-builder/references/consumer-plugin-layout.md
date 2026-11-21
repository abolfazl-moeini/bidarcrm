# Host-plugin layout and bootstrap

**Primary write target:** the plugin the user is developing (any plugin that depends on `wpdev`). Paths: [SHARED-PATHS.md](../../SHARED-PATHS.md). `@examples/` is optional read-only reference material (separate repo).

## Bootstrap recipe

```php
// my-shop/my-shop.php — top-level plugin bootstrap
/**
 * Plugin Name: My Shop
 * Requires Plugins: wpdev
 */
add_action( 'plugins_loaded', static function () {

    if ( ! function_exists( 'wpdev_services' ) ) {
        return; // WPDev not active
    }

    \WPDevFramework\Core\Module_Loader::register( 'my-shop-products', array(
        'path'         => __DIR__ . '/includes/products',
        'dependencies' => array( 'core', 'admin-page-builder', 'table-builder', 'metabox-builder', 'field-builder' ),
    ) );

    require_once __DIR__ . '/includes/products/setup.php';

    \WPDevFramework\Core\Module_Loader::mark_loaded( 'my-shop-products' );

}, 6 ); // priority > 5, after wpdev core Module_Loader::load_all()
```

Evidence: `Module_Loader::register()` stores any path (`{WPDEV}/modules/core/src/class-module-loader.php`); `load_module()` requires `{path}/setup.php`. Optional examples plugin uses the same manual pattern when installed.

## Library embed alternative (framework nested under host)

When the host **ships** the framework tree (e.g. `{HOST}/includes/framework/`) instead of depending on a separate `{PLUGINS}/wpdev` plugin. Canonical install notes: [INSTALL-AND-DISTRIBUTE.md](../../INSTALL-AND-DISTRIBUTE.md) § Library embed. WordPress.org host packaging: [docs/wordpress-org-readiness.md](../../../docs/wordpress-org-readiness.md) (slim tree only — **no `addons/`**).

```php
// my-shop/my-shop.php — host owns bootstrap + activation
/**
 * Plugin Name: My Shop
 * (Do NOT add Requires Plugins: wpdev — framework is embedded.)
 */
define( 'WPDEV_PLUGIN_FILE', __DIR__ . '/includes/framework/wpdev.php' );
define( 'WPDEV_HOST_PLUGIN_FILE', __FILE__ );
define( 'WPDEV_LIBRARY_MODE', true );
require_once WPDEV_PLUGIN_FILE;

register_activation_hook( __FILE__, array( 'WPDevFramework\\Hooks', 'on_activation' ) );
register_deactivation_hook( __FILE__, array( 'WPDevFramework\\Hooks', 'on_deactivation' ) );

add_action( 'plugins_loaded', static function () {

    if ( ! function_exists( 'wpdev_services' ) ) {
        return;
    }

    \WPDevFramework\Core\Module_Loader::register( 'my-shop-products', array(
        'path'         => __DIR__ . '/includes/products',
        'dependencies' => array( 'core', 'admin-page-builder', 'table-builder', 'metabox-builder', 'field-builder' ),
    ) );

    require_once __DIR__ . '/includes/products/setup.php';

    \WPDevFramework\Core\Module_Loader::mark_loaded( 'my-shop-products' );

}, 6 );
```

Hard rules for library embed:

1. Define `WPDEV_PLUGIN_FILE`, `WPDEV_HOST_PLUGIN_FILE`, and `WPDEV_LIBRARY_MODE` **before** `require`.
2. Drop `Requires Plugins: wpdev` (the framework is not a separate active plugin).
3. Register activation/deactivation on the **host** main file (framework skips its own hooks in library mode).
4. Path/URL helpers (`WPDEV_PLUGIN_DIR`, `wpdev_url()`, module assets) resolve to the nested framework folder automatically — no custom URL filters needed for a normal nest under `wp-content/plugins`.
5. Still use `plugins_url( …, MY_PLUGIN_FILE )` for **host** assets; `wpdev_url()` is framework-only.
6. Prefer not activating a sibling `{PLUGINS}/wpdev` while embedding. Accidental double-load is soft-fail: first copy wins (`WPDEV_LOADED`); `wpdev()` / `wpdev_boot_if_needed()` are wrapped in `function_exists` so PHP compile-time redeclaration does not fatal; admins get a warning notice.
7. For WordPress.org host zips: ship **slim** framework only — exclude `addons/`.
8. During `WP_SANDBOX_SCRAPING`, the embedded framework uses a light path:
   it loads activation `Hooks` but skips Action Scheduler, module discovery,
   and singleton boot. This is required because WordPress runs
   `plugin_sandbox_scrape()` before recording the host in `active_plugins`;
   heavy work there can produce a PHP-FPM/proxy 503.
9. A host's own late `WPDev\Core\Plugin::boot()` / `boot_all()` fallback must
   also be guarded by `! ( defined( 'WP_SANDBOX_SCRAPING' ) && WP_SANDBOX_SCRAPING )`. Keep host activation hooks after
   the framework `require`; do not replace this contract with an unconditional
   early return.
10. **Dual-boot function wrapping:** Dual-boot helper functions (e.g. `{slug}_bootstrap_wpdev_framework()`, `{slug}_load_textdomain()`) must always be wrapped in `if ( ! function_exists( ... ) )`. If both `{slug}-dev` and dist `{slug}` coexist, PHP registers unconditional top-level functions at compile time during `plugin_sandbox_scrape()` and throws `Fatal error: Cannot redeclare`.
11. **Autoloading parent class checks:** Never call `class_exists( Host_Table::class )` or `class_exists( Host_Model::class )` during `activate()` or `WP_SANDBOX_SCRAPING` without first verifying `class_exists( '\WPDevFramework\Database\Engine\Table' )` or `class_exists( '\WPDevFramework\Models\Base_Model' )`. When `wpdev_should_skip_heavy_bootstrap()` skips framework autoloaders, autoloading the host subclass directly fatals with `Class 'WPDevFramework\Database\Engine\Table' not found`.
12. **Method existence guards on shared singletons:** Late-boot calls on `\WPDev\Core\Plugin` or `\WPDev\Support\Assets` (`set_plugin_dir`, `register_vendor_scripts`, `boot`, `loader()->boot_all()`) must check `method_exists()` to protect against an older co-installed framework version winning Composer autoload first.

Host module registration (`Module_Loader::register` + `setup.php` + `mark_loaded`) is identical after the framework has loaded.

## Verified caveats

| Caveat | Why | Evidence |
|--------|-----|----------|
| Register **before** `require setup.php` | Wrong order = empty path fatal | `class-module-loader.php` |
| Host plugin must provide **own autoloading** | `Module_Autoloader` only covers `wpdev/modules/*` | `class-module-autoloader.php` |
| Do **not** use `wpdev_path()` / `wpdev_url()` / `wpdev_require_public_function()` for host files | They resolve relative to `WPDEV_PLUGIN_DIR` only (correct for framework assets in standalone **and** library embed) | `module-require.php`, `helper.php` |
| Call `mark_loaded()` after manual load | `wpdev_module_is_loaded()` / soft-dep checks need it | Module_Loader API |
| Add `Requires Plugins: wpdev` header | Prevents activation without framework — **skip** when using `WPDEV_LIBRARY_MODE` embed | WordPress plugin headers / [INSTALL-AND-DISTRIBUTE.md](../../INSTALL-AND-DISTRIBUTE.md) |
| Rely on early `return` alone after `WPDEV_LOADED` without `function_exists` around top-level helpers | Keep `function_exists( 'wpdev' )` / `wpdev_boot_if_needed` wrappers in `wpdev.php` | PHP compiles unconditional functions even when runtime returns early — standalone + embed would fatal |
| Multi-host-plugin ordering | No cross-plugin topological sort for arbitrary hosts | Order `plugins_loaded` priorities manually |
| Late host DB tables | Prefer `new My_Table()` + `$prefix` override; do not rely on register-only | [model-db-manager.md](model-db-manager.md) |

## Asset URLs in host plugins

Use WordPress helpers for your plugin's assets:

```php
plugins_url( 'assets/js/my-page.js', __FILE__ );
plugin_dir_path( __FILE__ );
```

`wpdev_get_module_asset_url()` works for modules registered with a `path` outside `WPDEV_PLUGIN_DIR` (`modules/core/src/functions-module-assets.php:88-112`), but prefer explicit host-plugin URLs when the module lives entirely in your plugin.

## Neutral default folder layout

When the host plugin has no existing convention, use this neutral layout (inspired by the optional products demo):

```text
my-shop/
  my-shop.php
  includes/
    products/
      setup.php
      src/
        access/
          class-product-access.php
        admin/
          class-product-list-admin-page.php
          class-product-edit-admin-page.php
        tables/
          class-product-list-table.php
        managers/
          class-product-manager.php
        Models/
          class-product.php
        Database/
          products/
            class-products-table.php
            class-products-schema.php
            class-product-query.php
      assets/
        js/
        css/
```

**Rule:** if the host plugin already has a folder convention, match it — do not force this layout over an established structure.

## setup.php shape

```php
use WPDevFramework\Core\Module_Loader;

defined( 'ABSPATH' ) || exit;

Module_Loader::register( 'my-shop-products', array(
    'path'         => __DIR__,
    'dependencies' => array( 'core', 'admin-page-builder', 'table-builder', 'metabox-builder', 'field-builder' ),
) );

// require_once domain classes or rely on Composer autoload

add_action( 'wpdev_load', static function () {
    // 1. Register domain permissions in catalog (Two-Gate Defense)
    wpdev_register_permission( 'my_shop.products.view', array(
        'owner'      => 'my-shop',
        'capability' => 'my_shop_view_products',
        'scope'      => 'site',
        'risk'       => 'read',
        'label'      => __( 'View Products', 'my-shop' ),
    ) );

    // 2. Register admin pages
    wpdev_register_module_admin_pages( 'my-shop-products', array(
        My_Product_List_Admin_Page::class,
        My_Product_Edit_Admin_Page::class,
    ) );

    // 3. Late host: direct construction + custom prefix (see model-db-manager.md)
    $table = new My_Products_Table();
    if ( ! $table->exists() && $table->is_upgradeable() ) {
        $table->install();
    }

    // 4. Boot manager
    wpdev_boot_module_manager( 'my-shop-products', My_Product_Manager::class, __DIR__ . '/src/managers/class-product-manager.php' );
} );
```

When bootstrapping from the top-level plugin file (first recipe), `Module_Loader::register()` in `setup.php` is optional if already registered in `my-shop.php`.

## Setup unfinished fallback (narrow, legacy-safe)

**As of WPDev 2.9.1:** `wpdev_setup_finished` no longer blocks `wpdev_load` /
`wpdev_admin_pages` / `wpdev_register_forms`. Host UI should boot on the normal
lifecycle. Keep the narrow fallbacks below only as a safety net for older
framework builds or unusual early-return paths (e.g. `Requirements::met()` false).

**Not the same as:** WPDev inactive (`function_exists( 'wpdev_services' )` false) — in that case return early and do not load host WPDev pages.

**STOP:** Re-verify current framework lifecycle before copying any host literally. Scope fallbacks narrowly; do **not** reimplement the whole framework boot.

Minimum pattern (host `setup.php` / panel bootstrap):

```php
// After normal registration hooks are attached…

// 1) Pages: if admin pages hook never ran, instantiate list/edit classes yourself
//    only when WPDev is active and your feature gate says setup-unfinished should still work.
if ( function_exists( 'wpdev_services' ) && ! did_action( 'wpdev_admin_pages' ) ) {
	// new My_List_Admin_Page(); new My_Edit_Admin_Page();
	// Prefer the same classes you register via wpdev_register_module_admin_pages().
}

// 2) Managers / tables: if load hook never ran
if ( function_exists( 'wpdev_services' ) && ! did_action( 'wpdev_load' ) ) {
	// boot manager + ensure table install (same code as wpdev_load callback)
}

// 3) Delete / modal forms: ensure form registration ran
if ( function_exists( 'wpdev_services' ) && ! did_action( 'wpdev_register_forms' ) ) {
	do_action( 'wpdev_register_forms' );
}
```

| Situation | Correct response |
|-----------|------------------|
| WPDev plugin inactive | Early return; no host WPDev UI |
| WPDev ≥ 2.9.1, setup unfinished | Rely on normal lifecycle; installer flag is unrelated to host UI |
| WPDev &lt; 2.9.1, setup unfinished | Narrow fallback so host pages/managers/forms still boot |
| WPDev active, setup finished | Rely on normal `wpdev_load` / `wpdev_admin_pages` / `wpdev_register_forms` |

**Scripts / Vue tabs:** Do **not** re-register `wpdev-vue-apps` in the host. `Edit_Admin_Page` / `List_Admin_Page` / `Settings_Admin_Page` call `Scripts::ensure_defaults_registered()` before enqueue when setup is unfinished (otherwise the settings body stays on the AJAX/block_ui spinner).

**Custom settings bodies:** If a host overrides `default_view()` without a Form that has `data-on-load="remove_block_ui"`, call `remove_block_ui()` from the custom Vue `mounted()` (framework also falls back when no `[data-on-load]` is present). See [settings-sections.md](../../wpdev-settings-dashboard/references/settings-sections.md) § Custom `default_view()`.

**Settings sections/fields:** Prefer `wpdev_register_settings_section` / `wpdev_register_settings_field` (they call `wpdev_ensure_settings()`). Do **not** register section defaults on early `plugins_loaded` if field defaults call WooCommerce/`get_permalink` — defer until page load / `get_sections()`. Under **WP 6.7+**, also defer any host-domain `__( … )` used at registration until `init` (see [settings-sections.md](../../wpdev-settings-dashboard/references/settings-sections.md) § WP 6.7+ i18n timing).

Do not document host-specific business rules here; keep the fallback framework-generic.