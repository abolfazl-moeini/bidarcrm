# API cookbook — panel APIs

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Entry template for every symbol below. Manifest `examples/{slug}/` = optional `@examples/{slug}/` when that separate repo is installed. **Write** adapted code into the **host plugin** per [consumer-plugin-layout.md](consumer-plugin-layout.md). Domain APIs: [api-cookbook-domain.md](api-cookbook-domain.md).

**Out of scope for this skill pack:** playground (`wpdev-pg-*`, `wpdev_register_playground_panel`) — use production recipes / optional `@examples/` instead.

---

## A. Registry facades (`wpdev_register_*`)

### wpdev_register_table

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_table( string $property, string $factory )` |
| Hook | Early `setup.php` (before `Table_Loader` boots) |
| When | Register custom DB table factory (examples / early modules) |
| Full example | Optional `@examples/products/setup.php` when examples installed |
| Doc | `@framework/modules/core/API_DOC.md` |
| Host note | Late host plugins: prefer direct `new My_Table()` + `$prefix` override — see [model-db-manager.md](model-db-manager.md) |

```php
// Early / examples-style only:
wpdev_register_table( 'product_table', \My_Shop\Database\Products\Products_Table::class );

// Late host plugin (safe default):
$table = new \My_Shop\Database\Products\Products_Table(); // set $prefix on the class
if ( ! $table->exists() && $table->is_upgradeable() ) {
    $table->install();
}
```

### wpdev_register_permission

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_permission( string $id, array $config = array(), bool $replace = true ): bool` |
| Hook | `wpdev_load` |
| When | Register named permission in catalog (`Permission_Registry`) |
| Doc | `@framework/modules/core/API_DOC.md` |

```php
wpdev_register_permission( 'my_shop.products.view', array(
    'owner'      => 'my-shop',
    'capability' => 'my_shop_view_products', // Gate 1: native WP capability
    'scope'      => 'site',                  // 'site' | 'network'
    'risk'       => 'read',                  // 'read' | 'write' | 'destructive' | 'administer'
    'label'      => __( 'View Products', 'my-shop' ),
    'policy'     => 'my_shop_products',      // Optional: policy ID in Access_Policy_Registry
) );
```

### wpdev_register_access_policy

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_access_policy( string $id, array $config = array(), bool $replace = true ): bool` |
| Hook | `wpdev_load` |
| When | Register domain policy qualifier (`Access_Policy_Registry`) |
| Doc | `@framework/modules/core/API_DOC.md` |

```php
wpdev_register_access_policy( 'my_shop_products', array(
    'owner'     => 'my-shop',
    'qualifier' => new My_Product_Access(), // UserAccess subclass, QualifierBase, or callable
) );
```

### wpdev_register_module_admin_pages

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_module_admin_pages( string $module_id, array $page_classes, int $priority = 10, array $overrides_map = array() )` |
| Hook | `setup.php` |
| When | Register list/edit admin page classes |
| Full example | `@examples/products/setup.php` |
| Doc | `@framework/modules/core/API_DOC.md` |

```php
wpdev_register_module_admin_pages( 'my-shop-products', array(
    \My_Shop\Admin\Product_List_Admin_Page::class,
    \My_Shop\Admin\Product_Edit_Admin_Page::class,
) );
```

### wpdev_boot_module_manager

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_boot_module_manager( string $module_id, string $manager_class, ?string $manager_path = null, int $priority = 5 )` |
| Hook | Called from `setup.php`; boots on `wpdev_load` |
| When | Singleton domain manager |
| Full example | `@examples/products/setup.php` |

```php
wpdev_boot_module_manager(
    'my-shop-products',
    \My_Shop\Managers\Product_Manager::class,
    __DIR__ . '/src/managers/class-product-manager.php'
);
```

### wpdev_register_module_views

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_module_views( string $module_id, ?string $path = null )` |
| When | Register module `views/` directory |
| Full example | `@examples/checkout/setup.php` |

```php
wpdev_register_module_views( 'wpdev-checkout' );
```

### wpdev_register_admin_page

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_admin_page( string $class_name, array $args = array(), int $priority = 100 )` |
| When | Re-bind page under alternate parent menu |
| Full example | `@framework/modules/core/examples/` |
| Doc | `@framework/modules/core/API_DOC.md` |

```php
wpdev_register_admin_page( Product_List_Admin_Page::class, array(
    'parent'  => 'my-plugin-menu',
    'context' => 'admin',
) );
```

### wpdev_register_ajax_handler

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_ajax_handler( string $action, callable $callback, array $args = array() )` |
| Hook | `wpdev_load` |
| When | Custom ajax action |
| Full example | `@examples/products/src/admin/` |
| Doc | `@framework/modules/core/API_DOC.md` |

```php
wpdev_register_ajax_handler( 'delete_product', static function () {
    if ( function_exists( 'wpdev_can' ) && ! wpdev_can( 'my_shop.products.delete' ) ) {
        wpdev_ajax_error( __( 'Not allowed.', 'wpdev' ), 'forbidden', null, 403 );
    }
    wpdev_ajax_success( array( 'deleted' => true ) );
}, array(
    'access' => 'my_shop.products.delete', // Two-Gate access ID
) );
```

Key `$args` (defaults): `'access'` (primary Two-Gate access ID, evaluated via `wpdev_can()`),
`capability` (`manage_network`, mapped through `wpdev_admin_capability_for()`, legacy fallback
when `access` is omitted), `capability_callback` (overrides `capability`),
`skip_nonce` (**false** — client must post field `nonce` with a
`wp_create_nonce( 'wpdev-ajax-nonce' )` value; enqueue with the `wpdev-ajax` dep),
`nonce_action` (`wpdev-ajax-nonce`), `nonce_field` (`nonce`), `transport`
(`admin` | `light` | `both` | `nopriv`), `nopriv` (false).

A missing client nonce returns 403 `Invalid security token` and leaves success-only
JS stuck on its loading state — see
`wpdev-modal-forms/references/ajax-stuck-loading.md`. Only read-only preview
endpoints may set `skip_nonce => true`, always paired with a capability gate.

### wpdev_register_service

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_service( string $id, Service_Contract $service, bool $replace = true )` |
| When | Register core service implementation |
| Doc | `@framework/modules/core/API_DOC.md` |

```php
wpdev_register_service( 'my-service', new My_Service() );
```

### wpdev_register_event_listener

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_register_event_listener( string $slug, callable $callback, int $priority = 10, int $accepted_args = 1 )` |
| When | Listen to named event bus event |

```php
wpdev_register_event_listener( 'product.saved', static function ( $payload ) {
    // Side effect.
} );
```

### wpdev_register_global_event_listener

| Field | Value |
|-------|-------|
| Signature | `wpdev_register_global_event_listener( callable $callback, int $priority = 10, int $accepted_args = 2 )` |
| When | Listen to all events |

```php
wpdev_register_global_event_listener( static function ( $event_slug, $payload ) {
    // Log or react to any event.
} );
```

### wpdev_register_list_table

| Field | Value |
|-------|-------|
| Module | table-builder |
| Signature | `wpdev_register_list_table( string $table_id, string $class_name, ?Table_Config $config = null, bool $replace = true ): bool` |
| When | Global list table registry (widgets/metaboxes) — **not** domain CRUD default |
| Doc | `@framework/modules/table-builder/API_DOC.md` |

```php
wpdev_register_list_table( 'product_table_ui', Product_List_Table::class );
```

### wpdev_register_field_type

| Field | Value |
|-------|-------|
| Module | field-builder |
| Signature | `wpdev_register_field_type( string $type, array $config = array(), bool $replace = true )` |
| Hook | `wpdev_load` |
| Doc | `@framework/modules/field-builder/API_DOC.md` |

```php
wpdev_register_field_type( 'color', array( 'class' => Color_Field_Template::class ), true );
```

### wpdev_register_field_template

| Field | Value |
|-------|-------|
| Module | checkout (example) |
| Signature | `wpdev_register_field_template( string $field_type, string $field_template_id, string $field_template_class_name )` |
| Hook | `wpdev_load` |
| When | Register a template class for a checkout field type |
| Full example | `@examples/checkout/setup.php` |
| Doc | `@examples/checkout/API_DOC.md` |

```php
wpdev_register_field_template( 'pricing-table', 'default', Pricing_Table_Field_Template::class );
```

### wpdev_register_form

| Field | Value |
|-------|-------|
| Module | form-builder |
| Signature | `wpdev_register_form( string $form_id, array $atts = array() )` |
| Hook | `wpdev_load` or `wpdev_register_forms` action |
| Full example | `@examples/checkout/setup.php` |
| Doc | `@framework/modules/form-builder/API_DOC.md` |

```php
wpdev_register_form( 'add_note', array(
    'title'   => __( 'Add Note', 'wpdev' ),
    'fields'  => array( 'note' => array( 'type' => 'textarea', 'title' => __( 'Note', 'wpdev' ) ) ),
    'handler' => array( $this, 'handle_add_note' ),
    'access'  => 'my_shop.notes.create', // Two-Gate access ID (evaluates wpdev_can)
) );
```

### wpdev_register_ajax_modal

| Field | Value |
|-------|-------|
| Module | form-builder |
| Signature | `wpdev_register_ajax_modal( string $id, callable $callback, array $args = array() )` |
| When | Ajax-driven modal without full form registry |
| Doc | `@framework/modules/form-builder/API_DOC.md` |

```php
wpdev_register_ajax_modal( 'quick_edit', array( $this, 'render_quick_edit_modal' ), array(
    'capability' => 'wpdev_edit_products',
) );
```

### wpdev_register_ajax_tabs

| Field | Value |
|-------|-------|
| Module | core / form-builder |
| Signature | `wpdev_register_ajax_tabs( string $group, callable $callback )` |
| When | Ajax tab group on edit pages |

```php
wpdev_register_ajax_tabs( 'product_tabs', array( $this, 'render_ajax_tab' ) );
```

### wpdev_register_settings_section

| Field | Value |
|-------|-------|
| Module | settings-panel-builder |
| Signature | `wpdev_register_settings_section( string $section_slug, array $atts, bool $replace = true )` |
| Hook | `wpdev_load` |
| Full example | `@examples/admin-setting-page-defaults/setup.php` |
| Doc | `@framework/modules/settings-panel-builder/API_DOC.md` |

```php
wpdev_register_settings_section( 'general', array(
    'title' => __( 'General', 'wpdev' ),
    'icon'  => 'dashicons-wpdev-cog',
) );
```

### wpdev_register_settings_field

| Field | Value |
|-------|-------|
| Signature | `wpdev_register_settings_field( string $section_slug, string $field_slug, array $atts )` |
| Hook | `wpdev_load` |

```php
wpdev_register_settings_field( 'general', 'site_name', array(
    'type'  => 'text',
    'title' => __( 'Site Name', 'wpdev' ),
) );
```

### wpdev_register_settings_side_panel

| Field | Value |
|-------|-------|
| Signature | `wpdev_register_settings_side_panel( string $section_slug, array $atts )` |
| When | Contextual help panel beside settings |

```php
wpdev_register_settings_side_panel( 'general', array(
    'title'   => __( 'Help', 'wpdev' ),
    'content' => __( 'Configure general options.', 'wpdev' ),
) );
```

### wpdev_register_metabox

| Field | Value |
|-------|-------|
| Module | metabox-builder |
| Signature | `wpdev_register_metabox( string $page_id, string $metabox_id, array $config = array(), bool $replace = true )` |
| Full example | `@examples/metabox-post-type/setup.php` |
| Doc | `@framework/modules/metabox-builder/API_DOC.md` |

```php
wpdev_register_metabox( 'wpdev-edit-product', 'inventory', array(
    'title'    => __( 'Inventory', 'wpdev' ),
    'callback' => array( $this, 'render_inventory' ),
) );
```

### wpdev_register_user_section

| Field | Value |
|-------|-------|
| Module | user-profile-builder |
| Signature | `wpdev_register_user_section( string $id, array $config ): bool` |
| Hook | `wpdev_load` or `init` |
| When | Register custom profile section/fields on `profile.php`, `user-edit.php`, `user-new.php` |
| Doc | `@framework/modules/user-profile-builder/API_DOC.md` |

```php
wpdev_register_user_section( 'vendor_profile', array(
    'title'       => __( 'Vendor Profile', 'my-plugin' ),
    'description' => __( 'Configure marketplace vendor profile.', 'my-plugin' ),
    'capability'  => 'edit_user', // Gate 1: native WP cap
    'roles'       => array( 'vendor', 'administrator' ), // Optional role filter
    'priority'    => 20,
    'fields'      => array(
        'store_name' => array(
            'type'  => 'text',
            'title' => __( 'Store Name', 'my-plugin' ),
        ),
    ),
) );
```

### wpdev_register_menu_top

| Field | Value |
|-------|-------|
| Module | menu-builder |
| Signature | `wpdev_register_menu_top( string $slug, array $args )` |
| Doc | `@framework/modules/menu-builder/API_DOC.md` |

```php
wpdev_register_menu_top( 'my-app', array(
    'title' => __( 'My App', 'wpdev' ), 'capability' => 'manage_options', 'callback' => 'my_app_render',
) );
```

### wpdev_register_menu_child

| Field | Value |
|-------|-------|
| Signature | `wpdev_register_menu_child( string $parent_slug, string $slug, array $args )` |

```php
wpdev_register_menu_child( 'my-app', 'my-app-settings', array(
    'title' => __( 'Settings', 'wpdev' ), 'capability' => 'manage_options', 'callback' => 'my_settings',
) );
```

### wpdev_register_menu_page

| Field | Value |
|-------|-------|
| Module | menu-builder |
| Signature | `wpdev_register_menu_page( string $page_slug, array $config = array(), bool $replace = true )` |
| When | Declarative menu metadata registry |
| Doc | `@framework/modules/menu-builder/API_DOC.md` |

```php
wpdev_register_menu_page( 'my-app', array(
    'title'      => __( 'My App', 'wpdev' ),
    'capability' => 'manage_options',
    'context'    => 'network',
) );
```

### wpdev_register_dashboard_widget

| Field | Value |
|-------|-------|
| Module | admin-widget-builder |
| Signature | `wpdev_register_dashboard_widget( string $id, array $config = array(), bool $replace = true ): bool` |
| Hook | `wpdev_load` |
| Full example | `@examples/admin-custom-page-dashboard-widgets/setup.php` |
| Doc | `@framework/modules/admin-widget-builder/API_DOC.md` |

```php
wpdev_register_dashboard_widget( 'revenue', array(
    'tab' => 'general', 'title' => __( 'Revenue', 'wpdev' ),
    'view' => 'dashboard-statistics/widget-revenue', 'datasource' => static fn() => array(),
) );
```

### wpdev_register_page_template

| Field | Value |
|-------|-------|
| Module | admin-page-builder |
| Signature | `wpdev_register_page_template( string $layout_type, string $view_path, bool $replace = true )` |
| Doc | `@framework/modules/admin-page-builder/API_DOC.md` |

```php
wpdev_register_page_template( 'grid', 'base/grid' );
```

### wpdev_register_admin_bar_node

| Field | Value |
|-------|-------|
| Module | admin-custom-page |
| Signature | `wpdev_register_admin_bar_node( string $id, array $config = array(), bool $replace = true )` |
| When | WP admin bar extension on custom page |

```php
wpdev_register_admin_bar_node( 'wpdev-quick', array( 'title' => 'WPDev', 'href' => wpdev_network_admin_url( 'wpdev' ) ) );
```

### wpdev_require_public_function

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_require_public_function( string $basename )` |
| Hook | `wpdev_load` |
| When | Lazy-load a **framework** public API file from `wpdev_public_function_map()` |

Map is framework-only (`ajax`, `date`, `settings`, …). Domain files (`product`, `customer`, `site`, …) are **not** in the map — they load from `@examples/{slug}/setup.php` when `wpdev-examples` is active. Calling `wpdev_require_public_function( 'product' )` triggers `_doing_it_wrong`.

```php
add_action( 'wpdev_load', static fn() => wpdev_require_public_function( 'ajax' ), 1 );
```

---

## B. Lifecycle hooks and schedulers

### wpdev_on_load

| Field | Value |
|-------|-------|
| Signature | `wpdev_on_load( callable $callback, int $priority = 10 )` |
| When | Schedule registration on `wpdev_load` |

```php
wpdev_on_load( static function () {
    wpdev_register_settings_section( 'addon', array( 'title' => __( 'Add-on', 'wpdev' ) ) );
} );
```

### wpdev_on_admin_pages

| Field | Value |
|-------|-------|
| Signature | `wpdev_on_admin_pages( callable $callback, int $priority = 10 )` |
| When | Schedule work on `wpdev_admin_pages` |

```php
wpdev_on_admin_pages( static function () {
    wpdev_register_admin_page( My_Page::class, array( 'parent' => 'wpdev' ) );
} );
```

### wpdev_load_module

| Field | Value |
|-------|-------|
| Signature | `wpdev_load_module( string $module_id, string $modules_dir = '' )` |
| When | Load single module with deps (tests/isolated use) |

```php
wpdev_load_module( 'table-builder' );
```

### wpdev_module_is_loaded

| Field | Value |
|-------|-------|
| Signature | `wpdev_module_is_loaded( string $module_id ): bool` |
| When | Guard widget/settings registration |

```php
if ( wpdev_module_is_loaded( 'admin-custom-page' ) ) { /* register widgets */ }
```

### WordPress action hooks

| Hook | Purpose |
|------|---------|
| `wpdev_init` | Early services, singletons |
| `wpdev_load` | `wpdev_register_*`, managers, public functions |
| `wpdev_admin_pages` | Admin page instantiation |
| `wpdev_register_forms` | Modal/ajax form registration |
| `wpdev_register_field_types` | Checkout field type registration |
| `wpdev_register_field_templates` | Checkout field template registration |
| `wpdev_modules_loaded` | Framework modules loaded; examples load here |

> **Lifecycle trap:** all `wpdev_*` hooks fire **inside** `plugins_loaded`. Code that
> runs in a `wpdev_load` / `wpdev_init` callback must never re-hook
> `plugins_loaded` — that hook already fired. `init` has not fired yet, but
> deferring a registry needed during the current WPDev lifecycle to `init` can
> still be too late; default light-Ajax may terminate before `init`. Re-register
> on `wpdev_load` with a later priority, and reserve `init` for intentional later
> work such as host i18n.

---

## C. Getters, savers, and registry helpers

### wpdev_get_setting

| Field | Value |
|-------|-------|
| Signature | `wpdev_get_setting( string $setting, mixed $default = false )` |
| Full example | `@examples/admin-setting-page-defaults/` |

```php
$api_key = wpdev_get_setting( 'stripe_api_key', '' );
```

### wpdev_save_setting

| Field | Value |
|-------|-------|
| Signature | `wpdev_save_setting( string $setting, mixed $value ): bool` |

```php
wpdev_save_setting( 'stripe_api_key', sanitize_text_field( $value ) );
```

### wpdev_get_option / wpdev_save_option

| Field | Value |
|-------|-------|
| Source | `@framework/modules/settings-panel-builder/src/functions/options.php` |
| Signature | `wpdev_get_option( $option_name = 'settings', $default = array() )`, `wpdev_save_option( $option_name = 'settings', $value = false )` |
| When | Raw **slugified option blob** access (whole settings array), **not** a single field key |

**Do not confuse with settings-field helpers:**

| API | Purpose |
|-----|---------|
| `wpdev_get_setting( $field_key, $default = false )` / `wpdev_save_setting( $field_key, $value )` | Individual registered settings fields |
| `wpdev_get_option( $option_name = 'settings', $default = array() )` / `wpdev_save_option( … )` | Entire option blob (slugified name) |

Site vs network storage:

- When `wpdev_uses_site_admin_context()` is true → `get_option()` / `update_option()`
- Otherwise → `get_network_option()` / `update_network_option()`

```php
// Whole settings blob (default option name is "settings"):
$all = wpdev_get_option( 'settings', array() );
wpdev_save_option( 'settings', $all );

// Single registered field — use get/save_setting, not get/save_option:
$api_key = wpdev_get_setting( 'stripe_api_key', '' );
wpdev_save_setting( 'stripe_api_key', sanitize_text_field( $value ) );
```

### wpdev_get_settings_section

| Field | Value |
|-------|-------|
| Signature | `wpdev_get_settings_section( string $section_slug ): ?array` |

### wpdev_get_db_table

| Field | Value |
|-------|-------|
| Source | `@framework/modules/core/src/functions/model.php` |
| Signature | `wpdev_get_db_table( string $name ): string` |
| When | Resolve the **physical** table name for a registered `wu_*` custom table slug (e.g. `products`, `productmeta`). Returns a string name, not a Table class instance. |

```php
// Physical table name string (not a factory):
$table_name = wpdev_get_db_table( 'products' );
```

For host Table class construction + install, see [model-db-manager.md](model-db-manager.md) (`new My_Table()`).

### wpdev_get_template

| Field | Value |
|-------|-------|
| Source | `@framework/modules/core/src/view/template-functions.php` |
| Signature | `wpdev_get_template( $view, $args = array(), $default_view = false ): void` |
| When | Render a module/framework view (echoes output; resolves via Module_View_Registry when available) |

### wpdev_get_form_url

| Field | Value |
|-------|-------|
| Source | `@framework/modules/form-builder/src/functions/form.php` |
| Signature | `wpdev_get_form_url( $form_id, $atts = array(), $inline = false ): string` |
| When | Wubox/modal form URL |

### Registry getters (uniform pattern)

```php
wpdev_get_{entity}( $id );
wpdev_has_{entity}( $id );
wpdev_list_{entity}();
wpdev_unregister_{entity}( $id );
```

Applies to: `dashboard_widget`, `settings_section`, `menu_page`, `form`, `field_type`, `list_table`, `metabox`, `permission`, `access_policy`.

---

## D. Access control and evaluation helpers

### wpdev_can

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_can( string $access_id, array $context = array() ): bool` |
| When | Evaluate Two-Gate access for the current actor (Gate 1 WP capability && Gate 2 AccessManager policy) |
| Doc | `@framework/modules/core/API_DOC.md` |

```php
if ( wpdev_can( 'my_shop.products.view' ) ) {
    // Current user has permission
}
```

### wpdev_can_for_user

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_can_for_user( mixed $user_id, string $access_id, array $context = array() ): bool` |
| When | Trusted server-side/audit evaluation for a specific user (never pass untrusted client input) |

### wpdev_require_access

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_require_access( string $access_id, array $context = array() ): void` |
| When | Assert access, throwing `Access_Denied_Exception` on failure |

```php
wpdev_require_access( 'my_shop.products.delete', array( 'product_id' => $id ) );
```

### wpdev_access

| Field | Value |
|-------|-------|
| Module | core |
| Signature | `wpdev_access(): \WPDevFramework\Core\Services\Access_Service` |
| When | Get the central `Access_Service` singleton coordinating permission/policy registries |

---

## E. Ajax and modal helpers

### wpdev_modal_open

| Field | Value |
|-------|-------|
| Signature | `wpdev_modal_open( string $form_id, array $args = array() )` |
| Full example | `@examples/customers/src/admin/` |

```php
wpdev_modal_open( 'add_note', array( 'customer_id' => $id ) );
```

### wpdev_ajax_success

| Field | Value |
|-------|-------|
| Signature | `wpdev_ajax_success( mixed $data = null, string $code = 'success' )` |

### wpdev_ajax_error

| Field | Value |
|-------|-------|
| Signature | `wpdev_ajax_error( string $message, string $code = 'error', mixed $data = null, int $status = 400 )` |

```php
wpdev_ajax_error( __( 'Invalid request.', 'wpdev' ), 'invalid', null, 400 );
```

### wpdev_ajax_url

| Field | Value |
|-------|-------|
| Source | `@framework/modules/core/src/functions/url.php` |
| Signature | `wpdev_ajax_url( $when = null, $query_args = array(), $site_id = false, $scheme = null ): string` |
| When | Light ajax endpoint URL (adds `wpdev-ajax=1` + nonce `r`); not a WordPress `admin-ajax.php?action=` helper |

---

## F. Base classes (extend, do not register)

### List_Admin_Page

| Field | Value |
|-------|-------|
| Class | `WPDevFramework\Admin_Pages\List_Admin_Page` |
| Source | `@framework/modules/admin-page-builder/src/admin/class-list-admin-page.php` |
| Required | `table(): Base_List_Table` |
| Full example | `@examples/products/src/admin/class-product-list-admin-page.php` |

Host-plugin shape (extend framework bases; domain classes use **host** namespaces — see [model-db-manager.md](model-db-manager.md)):

```php
namespace My_Shop\Admin;

use WPDevFramework\Admin_Pages\List_Admin_Page;

class Product_List_Admin_Page extends List_Admin_Page {
    protected $id = 'my-shop-products';
    public function table() { return new \My_Shop\List_Tables\Product_List_Table(); }
}
```

### Edit_Admin_Page

| Field | Value |
|-------|-------|
| Class | `WPDevFramework\Admin_Pages\Edit_Admin_Page` |
| Required | `get_object()` |
| Full example | `@examples/products/src/admin/class-product-edit-admin-page.php` |

```php
namespace My_Shop\Admin;

use WPDevFramework\Admin_Pages\Edit_Admin_Page;
use My_Shop\Models\Product;

class Product_Edit_Admin_Page extends Edit_Admin_Page {
    protected $parent = 'none';
    protected $highlight_menu_slug = 'my-shop-products';
    public function get_object() {
        return Product::get( (int) wpdev_request( 'id' ) ) ?: new Product();
    }
}
```

### Base_List_Table

| Field | Value |
|-------|-------|
| Class | `WPDevFramework\List_Tables\Base_List_Table` |
| Source | `@framework/modules/table-builder/src/table/class-base-list-table.php` |
| Full example | `@examples/products/src/tables/class-product-list-table.php` |

```php
namespace My_Shop\List_Tables;

use WPDevFramework\List_Tables\Base_List_Table;

class Product_List_Table extends Base_List_Table {
    protected $access      = 'my_shop.products.view'; // Two-Gate access ID for ajax refresh
    protected $query_class = '\\My_Shop\\Database\\Products\\Product_Query';
    public function get_columns() {
        return array( 'cb' => '', 'name' => __( 'Name', 'my-shop' ) );
    }
}
```

### Base_Model

| Field | Value |
|-------|-------|
| Class | `WPDevFramework\Models\Base_Model` |
| Source | `@framework/modules/core/src/Model/class-base-model.php` |
| Full example | `@examples/products/src/Models/class-product.php` |

### Table (DB engine)

| Field | Value |
|-------|-------|
| Class | `WPDevFramework\Database\Engine\Table` |
| Source | `@framework/modules/core/src/Database/engine/class-table.php` |
| Full example | `@examples/products/src/Database/Products/class-products-table.php` |

### Base_Manager

| Field | Value |
|-------|-------|
| Class | `WPDevFramework\Managers\Base_Manager` |
| Full example | `@examples/products/src/managers/class-product-manager.php` |

