# Debugging “Form not available”

`Form_Manager::security_checks()` intentionally uses the same message for two failures:

1. `get_form( $id )` returned false: registration/lifecycle failure.
2. Capability check failed after `wpdev_admin_capability_for( $form['capability'] )`: authorization mismatch.

Never assume the registry is missing until both branches are checked.

## Diagnostic order

### 1. Confirm the requested form ID

Compare the exact ID passed to `wpdev_get_form_url()` with the ID passed to `wpdev_register_form()`. Check the actual Ajax query parameter named `form`.

### 2. Inspect the registry

Run in the same WordPress request context as the failing site:

```php
$api     = wpdev_form_api();
$manager = method_exists( $api, 'manager' ) ? $api->manager() : $api;
$form    = $manager->get_form( 'my_modal' );

var_dump( did_action( 'wpdev_register_forms' ) );
var_dump( (bool) $form );
var_dump( array_keys( $manager->get_registered_forms() ) );
```

Interpretation:

- Hook count `0`: normal form lifecycle did not run; inspect setup/requirements and the narrow host fallback.
- Hook fired, form absent: callback attached too late, attached to the wrong hook, component not booted, or ID mismatch.
- Form present: continue to capability checks.

### 3. Inspect capability

```php
$cap = $form['capability'];
if ( function_exists( 'wpdev_admin_capability_for' ) ) {
	$cap = wpdev_admin_capability_for( $cap );
}
var_dump( $form['capability'], $cap, current_user_can( $cap ) );
```

Common failure: omitted `capability` inherits `manage_network`. On single-site that maps to `manage_options` via `wpdev_admin_capability_for()`; **custom** caps do not map — grant them or pick a real site/network cap. Keep the handler check aligned with the registered form capability (see [form-register-handler.md](form-register-handler.md) § Capability selection).

### 3b. Built-in `delete_modal` phantom capability (recurring)

`Form_Manager::register_action_forms()` registers `delete_modal` with a default
capability of `wpdev_delete_{$model}s` (e.g. `wpdev_delete_contacts`). That cap
is **never** added to any role by WPDev. Edit/list pages that call
`add_delete_widget()` / `row_action_delete_modal()` therefore return
**Form not available** for every user who only has the host page capability
(`manage_tavangary_crm`, `manage_woocommerce`, …).

This has recurred across host plugins. Prefer the host filter (core API):

```php
add_filter( 'wpdev_delete_modal_capability', static function ( $capability, $model ) {
    return 'contact' === $model ? 'manage_tavangary_crm' : $capability;
}, 10, 2 );
```

### 3c. Built-in `bulk_actions` capability on multisite (recurring)

`Form_Manager::register_action_forms()` registers `bulk_actions` with a default capability of `manage_network`. On WordPress Multisite, site administrators and shop managers do **not** have `manage_network`, resulting in **Form not available** when confirming bulk actions.

Prefer filtering the capability via `wpdev_bulk_actions_capability` or registering early on `wpdev_register_forms` (priority 5):

```php
// Option A: Core filter
add_filter( 'wpdev_bulk_actions_capability', static function ( $capability, $model ) {
    return 'price_edit' === $model ? 'manage_woocommerce' : $capability;
}, 10, 2 );

// Option B: Early registration (priority 5)
add_action( 'wpdev_register_forms', static function (): void {
    if ( function_exists( 'wpdev_register_form' ) && class_exists( '\WPDevFramework\Managers\Form_Manager' ) ) {
        $manager = \WPDevFramework\Managers\Form_Manager::get_instance();
        wpdev_register_form( 'bulk_actions', [
            'render'     => [ $manager, 'render_bulk_action_form' ],
            'handler'    => [ $manager, 'handle_bulk_action_form' ],
            'capability' => 'manage_woocommerce',
            'access'     => 'price_edit.manage',
        ] );
    }
}, 5 );
```

Fallback / legacy pattern (still valid): map via `user_has_cap` in the model
manager (same as `WheelManager::grant_delete_capability`):

```php
add_filter( 'user_has_cap', array( $this, 'grant_delete_capability' ), 10, 3 );

public function grant_delete_capability( $allcaps, $caps, $args ) {
    $cap = 'wpdev_delete_contacts'; // wpdev_delete_{model}s
    $wants = in_array( $cap, (array) $caps, true )
        || ( isset( $args[0] ) && $cap === $args[0] );
    if ( ! $wants ) {
        return $allcaps;
    }
    if ( ! empty( $allcaps['manage_tavangary_crm'] ) || ! empty( $allcaps['manage_options'] ) ) {
        $allcaps[ $cap ] = true;
    }
    return $allcaps;
}
```

Also required for delete to work end-to-end:

- `wpdev_get_{model}()` helper (or `wpdev_delete_form_get_object_{model}` filter)
- `wpdev_data_json_success_delete_{model}_modal` filter for the list redirect

Do **not** try to re-register `delete_modal` with a different capability via
`wpdev_register_form()` — first registration wins. Use the filter or map the
phantom cap instead.

Checklist item for every new WPDev CRUD panel: set
`wpdev_delete_modal_capability` (or map `wpdev_delete_{model}s` via
`user_has_cap`) when shipping Delete sidebar / row-action modals.

### 4. Verify hook timing

Correct hook with incorrect timing still fails:

```php
// Too late when wpdev_register_forms already fired.
add_action( 'wpdev_register_forms', 'register_my_modal' );
```

Recovery:

```php
add_action( 'wpdev_register_forms', 'register_my_modal' );

if ( did_action( 'wpdev_register_forms' ) ) {
    register_my_modal(); // Must be idempotent.
}
```

For **form registration**, do not switch from the WPDev lifecycle to
`plugins_loaded` or `init`; light-Ajax and normal requests can have different
boot timing. `init` remains valid for unrelated deferred work such as host
i18n on normal requests when it runs before its consumer, but default
light-Ajax can terminate before `init`; register the form on `wpdev_load` or
`wpdev_register_forms`.

The inverse failure is just as common: a manager that boots on `wpdev_load` calls
`add_action( 'plugins_loaded', ... )` from its `init()`. `wpdev_load` fires **inside**
`plugins_loaded`, so that hook already fired and the callback silently never runs —
the form (or any other registry entry) is never registered. Keep all registration on
WPDev lifecycle hooks (`wpdev_load`, `wpdev_register_forms`); never re-hook core
WordPress boot hooks from WPDev-booted code. This exact bug has recurred across
managers (forms, event types) — grep for `add_action( *'plugins_loaded'` inside any
`Managers/` class when a registry is unexpectedly empty.

### 5. Exercise the real display request

Registry-only checks do not prove authorization or rendering. Request the URL generated by `wpdev_get_form_url()` while authenticated, with:

- query parameter `form=my_modal`
- the request transport used by wubox/light-Ajax
- `X-Requested-With: XMLHttpRequest`

Assert that the response contains the expected form ID/title and does not contain `Form not available`.

When simulating WordPress from PHP CLI, set `$_GET` or `$_POST` before loading WordPress; core rebuilds `$_REQUEST` during bootstrap.

## Regression checklist

- [ ] Registration uses a WPDev lifecycle hook (`wpdev_load` for standalone
      components or `wpdev_register_forms` for page-owned forms)
- [ ] Callback is attached before the hook fires
- [ ] Late component directly calls an idempotent registration function
- [ ] Setup-unfinished fallback runs only after callbacks are attached
- [ ] Form ID matches URL/query ID exactly
- [ ] `capability` is explicit
- [ ] Current target user has that capability after `wpdev_admin_capability_for()` (custom caps must be granted as-is)
- [ ] **If using built-in `delete_modal`:** host sets `wpdev_delete_modal_capability` to the page capability (or maps `wpdev_delete_{model}s` via `user_has_cap`) **and** object resolution (`wpdev_get_{model}` or `wpdev_delete_form_get_object_{model}`)
- [ ] Handler re-checks with the same capability mapping as Form_Manager
- [ ] Registry inspection passes
- [ ] Authenticated Ajax display renders the form
- [ ] Unauthorized user is rejected
