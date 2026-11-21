# List page shell

Production list pages need capabilities, header actions, and `add_new` wiring aligned with the confirmed create flow.

## List_Admin_Page essentials

See orchestrator [admin-pages.md](../../wpdev-panel-builder/references/admin-pages.md).

| Property | Example |
|----------|---------|
| `$id` | `'wpdev-products'` or host id e.g. `'my-shop-products'` |
| `$supported_panels` | **Network SaaS:** `array( 'network_admin_menu' => 'manage_network' )` · **Site host:** `array( 'admin_menu' => 'my_plugin_view_items' )` (match permission capability) |
| `$type` | `'submenu'` (under parent) or `'menu'` (top-level with `$menu_icon` + `$position`) |

See orchestrator [admin-pages.md](../../wpdev-panel-builder/references/admin-pages.md) § “Choose admin context”.

| Method | Purpose |
|--------|---------|
| `table()` | `return new My_List_Table();` (declare `protected $access = 'my_plugin.items.view'` on table class) |
| `action_links()` | Top-right buttons (Add New) |

## Header button — full-page create (Products)

```php
array(
    'label' => __( 'Add Product', 'wpdev' ),
    'url'   => wpdev_network_admin_url( 'wpdev-edit-product' ),
),
```

## Header button — modal create (Domains)

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/domains/src/admin/class-domain-list-admin-page.php:322-327`

```php
array(
    'label'   => __( 'Add Domain', 'wpdev' ),
    'icon'    => 'wpdev-circle-with-plus',
    'classes' => 'wubox',
    'url'     => wpdev_get_form_url( 'add_new_domain' ),
),
```

## add_new wiring in list table

| Create flow | `add_new.url` | `add_new.classes` |
|-------------|---------------|-------------------|
| Full edit page | Direct edit-page URL | `''` |
| Modal | `wpdev_get_form_url( 'form_id' )` | `'wubox'` |

Optional sources (if examples installed): `@examples/products/src/tables/class-product-list-table.php:44-47` (full page) vs `@examples/domains/src/tables/class-domain-list-table.php:44-47` (modal).

## Extending a parent domain List_Table

| Situation | Extend |
|-----------|--------|
| Entity specializes an existing domain model table UI you control (or soft-depend) | Parent domain `*_List_Table` **if** that class is a public/stable dependency |
| Independent entity / no parent UI | `Base_List_Table` |
| Parent lives only in optional `@examples` | Prefer `Base_List_Table` + copy patterns; use `class_exists` if you deliberately soft-depend on examples |

Host production panels usually extend `Base_List_Table`. Extending `@examples` classes makes examples a hard runtime dependency — avoid unless the user accepted that.

## Screen Options columns

`List_Admin_Page::page_loaded()` binds the table to `get_current_screen()` so WordPress Screen Options lists toggleable columns via `manage_{$screen->id}_columns`. Do **not** pass `'screen' => $table_id` on page-context tables (that hides the Columns panel). Widget-scoped tables may keep a unique table/screen id so multiple tables on one edit page do not overwrite each other. Ajax refresh sends `list_table_screen` from `data-screen-id`.

Note: WordPress never offers toggles for special columns such as `cb` and `name`.

## Rules

- Capabilities on `$supported_panels` must match actions guarded in handlers.
- Modal create requires user confirmation + `wpdev-modal-forms` skill.
- Domain read/edit/action caps: [advanced-capabilities-and-settings.md](../../wpdev-advanced-panels/references/advanced-capabilities-and-settings.md).
