# Empty states

**Mechanism:** `Base_List_Table::display()` calls `wpdev_render_empty_state()` when zero items and `context === 'page'`. Set constructor args — no manual empty-state HTML normally needed.

## Minimal constructor (Products pattern)

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/products/src/tables/class-product-list-table.php:35-45`

```php
public function __construct() {
    parent::__construct( array(
        'singular' => __( 'Product', 'wpdev' ),
        'plural'   => __( 'Products', 'wpdev' ),
        'ajax'     => true,
        'add_new'  => array(
            'url'     => wpdev_network_admin_url( 'wpdev-edit-product' ),
            'classes' => '', // full-page create; use 'wubox' + wpdev_get_form_url() for modal
        ),
    ) );
}
```

## Optional sub-message override

Optional source (if examples installed): `@examples/products/src/tables/class-product-list-table.php:268-270`

```php
'empty_state' => array(
    'sub_message' => __( 'Create your first product to start selling.', 'wpdev' ),
),
```

## Framework defaults

Source: `@framework/modules/table-builder/src/table/class-base-list-table.php:762-814`

Produces:

- Message: `You don't have any {Plural} yet.`
- CTA: `Create a new {Singular}` when `add_new.url` is set
- Renderer: `wpdev_render_empty_state()` → `modules/core/views/base/empty-state.php`

## Wrapper on empty lists

`Base_List_Table::display()` wraps the empty state in the same `data-table-id` container as list mode (plus ajax filter hidden fields). Bulk Apply JS and Playwright locators need that attribute even when there are zero rows.

Filter chrome (`wpdev-opacity-50 wpdev-pointer-events-none`) disables only on an **unfiltered** empty list (`all` / no search); a filtered empty view keeps tabs clickable via `should_disable_filters_when_empty()`.

Do **not** echo a bare `wpdev_render_empty_state()` from a host `display()` override unless you also print that wrapper.

## Rules

- Always set `singular`, `plural`, and `add_new` in the list table constructor.
- Only override `sub_message` when domain-specific copy adds value.
- If `add_new` is empty, the framework shows a passive sub-message instead of a Create link.