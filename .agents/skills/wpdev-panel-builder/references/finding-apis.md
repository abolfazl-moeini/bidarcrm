# Finding and verifying APIs

When a WPDev function, hook, or class is unknown, follow this order. **Never guess signatures.**

Path placeholders: [SHARED-PATHS.md](../../SHARED-PATHS.md).

## Read order

1. **[api-cookbook.md](api-cookbook.md)** or **[api-cookbook-domain.md](api-cookbook-domain.md)** — signature + snippet + optional example path
2. **`{WPDEV}/docs/api/manifest.json`** — search symbol name
   - `doc` → `API_DOC.md` anchor
   - `source` → implementing PHP file
   - `usage.examples` → logical `@examples/` paths (optional; install examples submodule if you want those files)
   - `status` → `complete`, `partial`, `missing`
3. **Module `API_DOC.md`** — full contract
4. **Source file** — grep `function wpdev_{name}` or `class {Name}`
5. **`{WPDEV}/docs/api/inventory/*.json`** — usage counts
6. **`{WPDEV}/docs/api/framework-primitives.md`** — base classes
7. **Nearest example** — only if `{EXAMPLES}` exists: `@examples/{slug}/` or `@framework/modules/{module}/examples/`

## manifest.json lookup

**If the skill is running from inside the framework checkout** (`skills/wpdev-panel-builder/` → framework root is `../../`):

```bash
rg '"name": "wpdev_register_form"' ../../docs/api/manifest.json
```

**If the skill is running from a standalone pack:** do **not** use `../../` as framework root. Ask the user for `{WPDEV}` or detect the active `wpdev` plugin, then:

```bash
rg '"name": "wpdev_register_form"' "{WPDEV}/docs/api/manifest.json"
```

Sample entry:

```json
{
  "name": "wpdev_register_form",
  "owner": "form-builder",
  "doc": "modules/form-builder/API_DOC.md#wpdev_register_form",
  "source": "modules/form-builder/src/functions/form.php",
  "usage": { "examples": ["@examples/checkout/setup.php"] },
  "status": "complete"
}
```

Manifest logical path `examples/{slug}/` maps to alias `@examples/{slug}/` when examples are installed.

## Function loader map

`@framework/modules/core/src/functions/module-require.php`

```php
wpdev_public_function_map();              // framework basenames only
wpdev_require_public_function( $basename ); // e.g. ajax, date — NOT product/site/customer
```

Domain public functions (`product.php`, `customer.php`, …) are owned by `@examples/` and loaded in each example’s `setup.php`. Do not put them through `wpdev_require_public_function()`.

## Register facade quick index

| Entity | Register | Cookbook section |
|--------|----------|------------------|
| Permission (catalog) | `wpdev_register_permission` | A |
| Access policy | `wpdev_register_access_policy` | A |
| DB table | Host: direct `new My_Table()` (+ prefix). Early/examples: `wpdev_register_table` | [model-db-manager.md](model-db-manager.md), [api-cookbook.md](api-cookbook.md) A |
| Admin pages | `wpdev_register_module_admin_pages` | A |
| Manager | `wpdev_boot_module_manager` | A |
| Ajax | `wpdev_register_ajax_handler` | A + E |
| List table UI (domain CRUD) | `new My_List_Table()` in `List_Admin_Page::table()` — **not** `wpdev_register_list_table()` | anti-patterns #6, F |
| Field type | `wpdev_register_field_type` | A |
| Form / modal | `wpdev_register_form`, `wpdev_modal_open` | A + E |
| Ajax modal | `wpdev_register_ajax_modal` | A + E |
| Settings | `wpdev_register_settings_section`, `wpdev_register_settings_field` | A + C |
| Metabox | `wpdev_register_metabox` | A |
| Menu | `wpdev_register_menu_top`, `wpdev_register_menu_child` | A |
| Dashboard widget | `wpdev_register_dashboard_widget` | A |
| Page template | `wpdev_register_page_template` | A |
| Gateway/checkout/events | domain APIs | [api-cookbook-domain.md](api-cookbook-domain.md) |

## Grep recipes

Always search the framework first (required):

```bash
rg "function wpdev_register_form\s*\(" "{WPDEV}/modules/"
rg "wpdev_register_settings_field" "{WPDEV}/docs/"
```

Search examples only if the folder exists (optional separate repo):

```bash
# Optional: install as git submodule from https://github.com/abolfazl-moeini/wpdev-examples.git
if [ -d "{EXAMPLES}" ]; then
  rg "add_action\s*\(\s*'wpdev_load'" "{EXAMPLES}/"
  rg "extends List_Admin_Page" "{EXAMPLES}/"
fi
```

From a framework checkout (not a standalone pack), `{WPDEV}` may be `../..` relative to this skill.

## Base class source

| Class | Path |
|-------|------|
| `List_Admin_Page` | `@framework/modules/admin-page-builder/src/admin/class-list-admin-page.php` |
| `Edit_Admin_Page` | `@framework/modules/admin-page-builder/src/admin/class-edit-admin-page.php` |
| `Base_List_Table` | `@framework/modules/table-builder/src/table/class-base-list-table.php` |
| `Base_Model` | `@framework/modules/core/src/Model/class-base-model.php` |
| `Table` | `@framework/modules/core/src/Database/engine/class-table.php` |

## When docs disagree with source

**Source wins.** Implement from source; fix stale `API_DOC.md` separately.

## Regenerating API docs

When doc tooling is available, regenerate `{WPDEV}/docs/api/manifest.json` after API changes. Prefer manual `rg` validation against `{WPDEV}` when unsure of the skill pack location.
