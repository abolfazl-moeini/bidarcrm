# Modal create ("Create a new X")

**Flow:** register modal form → wire `add_new` with `wubox` class → render `Form` → handler calls `wp_send_json_success/error`.

## Register form

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/domains/src/admin/class-domain-list-admin-page.php:70-74`

```php
wpdev_register_form( 'add_new_domain', array(
    'render'     => array( $this, 'render_add_new_domain_modal' ),
    'handler'    => array( $this, 'handle_add_new_domain_modal' ),
    'access'     => 'acme.domains.create',    // Two-Gate access ID (evaluates wpdev_can)
    'capability' => 'wpdev_edit_domains',     // Legacy fallback if access is omitted
) );
```

Registered on `wpdev_register_forms` via admin page base (`class-base-admin-page.php:256`).
`Form_Manager::security_checks()` evaluates `'access'` via `wpdev_request_access_is_allowed()` and `wpdev_can()`, enforcing the Two-Gate Defense-in-Depth Model (Gate 1 WP base capability + Gate 2 AccessManager policy configured in `wpdev_register_permission()`). When `'access'` is omitted, it falls back to the legacy `'capability'` check.


This assumes the admin-page object is constructed before that hook fires. For late host plugins, setup-unfinished fallbacks, explicit capability selection, and “Form not available” diagnosis, follow [form-register-handler.md](form-register-handler.md) and [form-not-available.md](form-not-available.md).

## List table add_new

Optional source (if examples installed): `@examples/domains/src/tables/class-domain-list-table.php:44-47`

```php
'add_new' => array(
    'url'     => wpdev_get_form_url( 'add_new_domain' ),
    'classes' => 'wubox',
),
```

## Render callback

Optional source (if examples installed): `@examples/domains/src/admin/class-domain-list-admin-page.php:185-198`

```php
$form = new \WPDevFramework\UI\Form( 'add_new_domain', $fields, array(
    'views'   => 'admin-pages/fields',
    'classes' => 'wpdev-modal-form wpdev-widget-list wpdev-striped wpdev-m-0 wpdev-mt-0',
) );
$form->render();
```

## Handler

Optional source (if examples installed): `@examples/domains/src/admin/class-domain-list-admin-page.php:208-226` and `:252-256`

```php
public function handle_add_new_domain_modal() {
    $domain = wpdev_create_domain( array( /* wpdev_request() fields */ ) );
    if ( is_wp_error( $domain ) ) {
        wp_send_json_error( $domain );
    }
    wp_send_json_success( array(
        'redirect_url' => wpdev_network_admin_url( 'wpdev-edit-domain', array( 'id' => $domain->get_id() ) ),
    ) );
}
```

## Facades

```php
wpdev_register_form( $form_id, array( 'render' => ..., 'handler' => ..., 'capability' => ..., 'access' => ... ) );
wpdev_get_form_url( $form_id, $atts = array(), $inline = false );
wpdev_modal_open( $form_id, $args = array() );
```

Source: `@framework/modules/form-builder/src/functions/form.php`.