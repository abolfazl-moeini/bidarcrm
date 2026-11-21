# Embedded list table widget

For related records on an edit page (events, domains, line items).

Method: `Edit_Page_Widgets` trait — `@framework/modules/metabox-builder/src/admin/trait-edit-page-widgets.php`.

## Minimal recipe

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/products/src/admin/class-product-edit-admin-page.php:263-267`

```php
$this->add_list_table_widget( 'events', array(
    'title'        => __( 'Events', 'wpdev' ),
    'table'        => new Related_Events_List_Table(),
    'query_filter' => array( $this, 'query_filter' ), // optional: scope rows to current object
) );
```

More embedded tables (domains, membership, customer): `@examples/sites/src/admin/class-site-edit-admin-page.php:349-383`.

## Rules

- Pass a `Base_List_Table` instance (or subclass) in `table`.
- Use `query_filter` when the embedded table must filter by the edit page's object id.
- Embedded tables use `context !== 'page'` — they do **not** show the full-page empty-state CTA (that is list-page only).
