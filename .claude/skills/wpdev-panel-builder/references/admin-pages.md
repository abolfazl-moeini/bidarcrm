# Admin pages (List + Edit)

Source base classes in `@framework/modules/admin-page-builder/src/admin/`.

Registration: `wpdev_register_module_admin_pages()` — see [api-cookbook.md](api-cookbook.md).

Paths: [SHARED-PATHS.md](../../SHARED-PATHS.md). Write into the **host plugin**.

## Choose admin context (site vs network)

Skills historically show **network SaaS** defaults. Host plugins that live under WooCommerce / single-site use **site admin**.

| Host type | `$supported_panels` key | Typical capability |
|-----------|-------------------------|-------------------|
| Network SaaS screens (default in many demos) | `network_admin_menu` | `manage_network` or domain caps |
| Site / WooCommerce-style plugins | `admin_menu` | `manage_woocommerce`, `manage_options`, etc. |

```php
// Site-admin / WooCommerce host (common for single-site product plugins)
protected $supported_panels = array(
	'admin_menu' => 'manage_woocommerce',
);

// Network SaaS default (examples/framework demos)
protected $supported_panels = array(
	'network_admin_menu' => 'manage_network',
);
```

**Single-site translation:** when not in network context, `wpdev_translate_supported_panels( $panels )` maps network panels → site admin and adjusts **built-in** capabilities (`@framework/modules/core/src/functions/context.php`). Prefer declaring the panel you actually need rather than relying on translation for host plugins.

## Domain capabilities (brief)

List/edit/tool pages and modals often need **separate** read / edit / action capabilities — not one shared string everywhere. Full recipe: [advanced-capabilities-and-settings.md](../../wpdev-advanced-panels/references/advanced-capabilities-and-settings.md).

- Put the page-level cap on `$supported_panels`.
- Put action caps on `wpdev_register_form( …, 'capability' => … )` and re-check in the handler.
- Custom caps are **not** auto-translated by `wpdev_admin_capability_for()` (only `manage_network` / `manage_network_plugins` map on single-site).
- Hidden edit already covered below (`$parent = 'none'` + `$highlight_menu_slug`) — do not invent a second pattern.

Non-CRUD tool pages (export/import tabs): [custom-tool-page.md](../../wpdev-advanced-panels/references/custom-tool-page.md).

**URL helper:** `wpdev_network_admin_url( $page, $query )` resolves to `admin_url()` or `network_admin_url()` based on current context (`@framework/modules/core/src/functions/url.php`). Safe for both site and network pages when the page is registered in the active context. Adjacent host pages may also use `admin_url( 'admin.php?page=…' )` for site-only plugins.

**Top-level menu** (own sidebar item):

```php
protected $type      = 'menu'; // top-level is allowed
protected $menu_icon = 'dashicons-controls-repeat';
protected $position  = 56;
```

**Shared brand top-level** (multiple host plugins under one product menu — preferred for multi-plugin brands):

```php
// In each host plugin bootstrap (once per site):
if ( ! defined( 'WPDEV_BRAND_MENU_SLUG' ) ) {
	define( 'WPDEV_BRAND_MENU_SLUG', 'my-brand' ); // or filter `wpdev_brand_menu_slug`
}

// Admin page attaches as a child — brand top-level is created on-the-fly:
protected $type   = 'submenu';
protected $parent = 'my-brand'; // must equal brand slug
protected $id     = 'my-feature';

// Title defaults to site name; override:
add_filter( 'wpdev_brand_menu_title', fn() => __( 'My Brand', 'my-plugin' ) );

// plugins.php Settings link (WP 6.7+: leave label empty on plugins_loaded —
// framework translates "Settings" at display time; or register on init):
wpdev_register_plugin_settings_link(
	plugin_basename( MY_PLUGIN_FILE ),
	admin_url( 'admin.php?page=my-feature' )
);
```

See `@framework/modules/menu-builder/API_DOC.md` § Brand top-level menu.

**Submenu under WPDev framework menu** (legacy `$parent = 'wpdev'`):

```php
protected $type   = 'submenu';
protected $parent = 'wpdev';

protected $supported_panels = array(
	'admin_menu' => 'manage_woocommerce',
);
```

Label network-only examples as **“network SaaS default”**, not universal.

## List_Admin_Page — minimal shell

```php
namespace My_Shop\Admin;

use WPDevFramework\Admin_Pages\List_Admin_Page;

class Product_List_Admin_Page extends List_Admin_Page {

    protected $id = 'my-shop-products';

    protected $type = 'submenu';

    // Network SaaS default — use admin_menu + site cap for WooCommerce-style hosts (see above).
    protected $supported_panels = array(
        'network_admin_menu' => 'manage_network',
    );

    public function table() {
        return new \My_Shop\Tables\Product_List_Table();
    }

    public function get_title() {
        return __( 'Products', 'my-shop' );
    }

    public function get_menu_title() {
        return __( 'Products', 'my-shop' );
    }

    public function action_links() {
        return array(
            array(
                'label' => __( 'Add Product', 'my-shop' ),
                'url'   => wpdev_network_admin_url( 'my-shop-edit-product' ),
            ),
        );
    }
}
```

| Property | Purpose | Example |
|----------|---------|---------|
| `$id` | Page slug | `'my-shop-products'` |
| `$type` | Menu type | `'submenu'` or `'menu'` (top-level) |
| `$supported_panels` | Context + capability | `array( 'admin_menu' => '…' )` or network SaaS default |
| `$menu_icon` | Dashicon when `$type = 'menu'` | `'dashicons-controls-repeat'` |
| `$position` | Menu position when top-level | `56` |

| Method | Purpose |
|--------|---------|
| `table()` | `return new My_List_Table();` (**required**) |
| `get_title()` | Page heading |
| `get_menu_title()` | Sidebar label |
| `action_links()` | Top-right buttons (Add New) |
| `get_labels()` | Search/delete messages |

Lifecycle: instantiated on `wpdev_admin_pages` when `wpdev_module_enabled` is true.

## Edit_Admin_Page — minimal shell + save

```php
namespace My_Shop\Admin;

use WPDevFramework\Admin_Pages\Edit_Admin_Page;

class Product_Edit_Admin_Page extends Edit_Admin_Page {

    protected $id = 'my-shop-edit-product';

    protected $object_id = 'id';

    protected $parent = 'none';

    protected $highlight_menu_slug = 'my-shop-products';

    // Network SaaS default — use admin_menu + site cap for WooCommerce-style hosts.
    protected $supported_panels = array(
        'network_admin_menu' => 'manage_network',
    );

    public function get_object() {
        // return domain model for create/edit
    }

    public function register_widgets() {
        parent::register_widgets(); // Timestamps + Delete

        $this->add_fields_widget( 'description', array(
            'title'  => __( 'Description', 'my-shop' ),
            'fields' => array(
                'name' => array(
                    'type'  => 'text',
                    'title' => __( 'Name', 'my-shop' ),
                    'value' => $this->get_object()->get_name(),
                ),
            ),
        ) );

        $this->add_save_widget( 'save', array(
            'position' => 'side',
            'fields'   => array(),
        ) );
    }
}
```

| Property | Purpose |
|----------|---------|
| `$id` | Edit page slug |
| `$object_id` | Entity key |
| `$parent` | `'none'` hides from menu |
| `$highlight_menu_slug` | Keep list menu active |
| `$supported_panels` | Capability map |

| Method | Purpose |
|--------|---------|
| `get_object()` | Domain model (**required**) |
| `register_widgets()` | `add_fields_widget`, `add_tabs_widget`, `add_list_table_widget`, `add_save_widget` |
| `handle_save()` | Pre/post save |
| `register_forms()` | Ajax modal forms |

Save: POST → `process_save()` → `handle_save()` → model save.

### Registration-time title safety

WordPress calls `get_title()`, `get_menu_title()`, and related label methods
while building `admin_menu` for every registered page, including hidden edit
pages and unrelated current screens. These methods must be side-effect free.

- Do not call a redirecting `get_object()` from a title/menu-label method.
- Do not redirect merely because the request has no edit `id` during menu
  registration.
- Use a static fallback title unless the current page is the edit page and a
  valid object id is present.
- Keep missing-object redirects in the edit page load lifecycle (`page_loaded()`
  / `get_object()` reached from that page), not in registration-time labels.

```php
public function get_title() {
	$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	$id   = absint( wpdev_request( 'id', 0 ) );

	if ( 'my-shop-edit-product' !== $page || ! $id ) {
		return __( 'Edit Product', 'my-shop' );
	}

	return sprintf(
		__( 'Edit Product: %s', 'my-shop' ),
		$this->get_object()->get_name()
	);
}
```

## Menu pattern (list + edit pair)

| Page | `$type` | `$parent` | Visible |
|------|---------|-----------|---------|
| List | `submenu` | default | Yes |
| Edit | `submenu` | `'none'` | No (direct URL) |

Edit URL: `wpdev_network_admin_url( 'my-shop-edit-product', array( 'id' => $id ) )`.

## Register both pages

```php
wpdev_register_module_admin_pages( 'my-shop-products', array(
    Product_List_Admin_Page::class,
    Product_Edit_Admin_Page::class,
) );
```

## Optional deeper reading

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

| Pattern | Path (optional) | Specialist |
|---------|-----------------|------------|
| Minimal list | `@examples/products/src/admin/class-product-list-admin-page.php` | list-ux |
| Rich edit | `@examples/customers/src/admin/class-customer-edit-admin-page.php` | edit-ux |
| Tabs + Save | `@examples/discount-codes/src/admin/class-discount-code-edit-admin-page.php` | edit-ux |
