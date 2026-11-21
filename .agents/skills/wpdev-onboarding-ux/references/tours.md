# Tour guide

API: `wpdev_create_tour( $id, $steps, $once = true )`.

Source: `@framework/modules/core/src/functions/tour.php:35-56`

Call from admin page `register_widgets()` (before `in_admin_header` — not from ajax).

## Example (Checkout Forms)

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/checkout/src/admin/class-checkout-form-list-admin-page.php:59-87`

```php
public function register_widgets() {
    wpdev_create_tour( 'checkout-form-list', array(
        array(
            'id'    => 'checkout-form-list',
            'title' => __( 'Checkout Forms', 'wpdev' ),
            'text'  => array(
                __( 'Checkout Forms are an easy and flexible way to experiment with different approaches when trying to convert new customers.', 'wpdev' ),
            ),
        ),
        array(
            'id'       => 'default-form',
            'title'    => __( 'Experiment!', 'wpdev' ),
            'text'     => array(
                __( 'You can create as many checkout forms as you want...', 'wpdev' ),
            ),
            'attachTo' => array(
                'element' => '#wpdev-wrap > h1 > a:first-child',
                'on'      => 'right',
            ),
        ),
    ) );
}
```

## Step shape

From `@framework/modules/core/API_DOC.md`: `id`, `title`, `text` (string or string[]), optional `attachTo.element` + `attachTo.on`, optional `buttons`.

## Rules

- Propose tours only for multi-step builders / pages with ≥3 metaboxes / non-obvious primary actions.
- Use page-level steps (no `attachTo`) when unsure about DOM targets.
- Ask user to confirm target element before using `attachTo`.