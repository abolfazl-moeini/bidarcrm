# Save widget and sidebar

Every edit page needs `add_save_widget` in the sidebar. Trait fixes title to "Save".

Source: `@framework/modules/metabox-builder/src/admin/trait-edit-page-widgets.php:429-455`

```php
$this->add_save_widget( 'save', array(
    'position' => 'side',
    'fields'   => array(
        'price' => array(
            'type'  => 'text',
            'title' => __( 'Price', 'wpdev' ),
        ),
        // submit_save is added by the trait
    ),
) );
```

With live JS state mirror (Discount Codes pattern):

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/discount-codes/src/admin/class-discount-code-edit-admin-page.php:240-252`

```php
$this->add_save_widget( 'save', array(
    'html_attr' => array(
        'data-wpdev-app' => 'save_discount_code',
        'data-state'     => wpdev_convert_to_state( array( /* field mirror */ ) ),
    ),
    'fields' => array( /* pricing fields */ ),
) );
```

## Rules

- Call `parent::register_widgets()` first for Timestamps + Delete.
- Save widget is **always-on** — no user confirmation needed.

## Delete widget / `delete_modal` capability (required)

`add_delete_widget()` opens the built-in form `delete_modal`, which defaults to
capability `wpdev_delete_{$model}s` (e.g. `wpdev_delete_contacts`). That phantom
cap is never granted by WPDev.

Without a host bridge to the page capability (`manage_tavangary_crm`,
`manage_woocommerce`, …), clicking Delete shows **Form not available**.

Preferred:

```php
add_filter( 'wpdev_delete_modal_capability', static function ( $capability, $model ) {
    return 'contact' === $model ? 'manage_tavangary_crm' : $capability;
}, 10, 2 );
```

See [form-not-available.md §3b](../../wpdev-modal-forms/references/form-not-available.md)
for the `user_has_cap` fallback. Also ship `wpdev_get_{model}()` and the
delete-success redirect filter.