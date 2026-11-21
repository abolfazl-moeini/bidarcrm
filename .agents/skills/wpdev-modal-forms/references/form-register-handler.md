# Form register / render / handler lifecycle

## Non-negotiable registration rules

1. Register Ajax/modal forms on a WPDev lifecycle hook: use `wpdev_load` for
   standalone components, or `wpdev_register_forms` for page-owned
   `register_forms()` callbacks. Do not wire normal registration directly to
   `plugins_loaded` or `init`.
2. Attach the callback **before** the selected WPDev hook fires. Attaching the
   correct hook after it fired is still a no-op.
3. Always set `'access'` (recommended) and/or `capability` explicitly. `Form_Manager` defaults to
   `manage_network`; on single-site WPDev maps that built-in capability to
   `manage_options`, but explicit registration is still required to choose the
   intended boundary. When `'access'` is supplied, `Form_Manager::security_checks()`
   routes evaluation to `wpdev_request_access_is_allowed()`, which calls `wpdev_can( $access )`
   to enforce the **Two-Gate Defense-in-Depth Model** (Gate 1 WP base capability + Gate 2
   AccessManager domain policy, configured via `wpdev_register_permission()`).
   When `'access'` is omitted, it falls back to the legacy `capability` check.
4. Use the same access boundary in registration and the handler. The handler must still re-check authorization (`wpdev_can` or `wpdev_require_access`).
5. Make registration idempotent so late boot fallbacks can call it directly without duplicating state.

```php
final class My_Modal_Form {
    const FORM_ID = 'my_modal';

    public static function init() {
        add_action( 'wpdev_register_forms', array( __CLASS__, 'register' ) );

        // If this component itself boots late, recover immediately.
        if ( did_action( 'wpdev_register_forms' ) ) {
            self::register();
        }
    }

    public static function register() {
        if ( ! function_exists( 'wpdev_register_form' ) ) {
            return;
        }

        wpdev_register_form( self::FORM_ID, array(
            'render'     => array( __CLASS__, 'render' ),
            'handler'    => array( __CLASS__, 'handle' ),
            'access'     => 'acme.modal.create',   // Two-Gate access ID (evaluates wpdev_can)
            'capability' => 'manage_woocommerce', // Legacy fallback if access is omitted
        ) );
    }
}
```

`wpdev_register_form()` ignores an already-registered ID, so direct recovery is safe. Do not rely on that alone when registration has side effects; guard those side effects separately.

This standalone example uses `wpdev_register_forms`; a component that registers
on `wpdev_load` should attach to that hook and use the same idempotent
`register()` method.

## Admin-page registration

Admin page subclasses normally attach `register_forms()` in their base constructor:

```php
public function register_forms() {
    wpdev_register_form( 'my_modal', array(
        'render'     => array( $this, 'render_my_modal' ),
        'handler'    => array( $this, 'handle_my_modal' ),
        'access'     => 'acme.modal.create',   // Two-Gate access ID (evaluates wpdev_can)
        'capability' => 'manage_woocommerce', // Legacy fallback if access is omitted
    ) );
}
```

This only works when the page object is constructed before `wpdev_register_forms`. If page construction happens afterward, call its idempotent registration method directly or move form wiring to an earlier bootstrap component.

Base class hook wiring: `@framework/modules/admin-page-builder/src/admin/class-base-admin-page.php`.

## Capability selection

Choose the capability from the actual UI/action boundary (read vs edit vs action may differ — see [advanced-capabilities-and-settings.md](../../wpdev-advanced-panels/references/advanced-capabilities-and-settings.md)):

| Context | Typical capability |
|---------|--------------------|
| Network-only admin screen | `manage_network` |
| Site admin screen | `manage_options` |
| WooCommerce management screen | `manage_woocommerce` |
| Domain-specific CRUD / tool action | The custom capability for **that** page or action |

Do not copy `manage_network` from an example into a site-admin host plugin unless you intend network SaaS.

`Form_Manager::security_checks()` runs the form capability through `wpdev_admin_capability_for()` before `current_user_can()`. On single-site, **only** built-in mappings apply (`manage_network` → `manage_options`, `manage_network_plugins` → `activate_plugins`). **Custom** capabilities are not rewritten — grant them explicitly for the target context.

## Render

- No parameters
- Echo a `WPDevFramework\UI\Form` instance
- Use `views => 'admin-pages/fields'` and `wpdev-modal-form` classes for modals

## Handler

- No parameters
- Read input via `wpdev_request()`
- Re-check the **same capability string** registered on the form (or map built-ins the same way display does)
- Must end with `wp_send_json_success()` / `wp_send_json_error()` (or `wpdev_ajax_*` for registered ajax handlers)
- Bulk/delete toggles: field **`name="confirm"`**, Vue state `confirmed` — read `confirm` (optional fallback `confirmed`). See [bulk-modal-context.md](../../wpdev-list-ux/references/bulk-modal-context.md).

Display uses `wpdev_admin_capability_for()` before `current_user_can()`. Handlers that check raw `manage_network` on single-site will **fail** for legitimate admins. Additionally, if the form specified an `'access'` policy, enforce Gate 2 via `wpdev_can()` or `wpdev_require_access()`. Prefer:

```php
public static function handle() {
	// Gate 1: Native WP capability
	$cap = 'manage_woocommerce'; // same string as wpdev_register_form( …, 'capability' )
	if ( function_exists( 'wpdev_admin_capability_for' ) ) {
		$cap = wpdev_admin_capability_for( $cap );
	}
	if ( ! current_user_can( $cap ) ) {
		wp_send_json_error(
			new \WP_Error( 'forbidden', __( 'You are not allowed to perform this action.', 'my-plugin' ) ),
			403
		);
	}

	// Gate 2: Domain access policy (if form registered with 'access')
	if ( function_exists( 'wpdev_can' ) && ! wpdev_can( 'acme.modal.create' ) ) {
		wp_send_json_error(
			new \WP_Error( 'forbidden_policy', __( 'Access denied by domain policy.', 'my-plugin' ) ),
			403
		);
	}

	if ( ! wpdev_request( 'confirm' ) && ! wpdev_request( 'confirmed' ) ) {
		wp_send_json_error( new \WP_Error( 'confirmation_required', __( 'Please confirm.', 'my-plugin' ) ) );
	}

	// Validate input and perform the action.
	wp_send_json_success();
}
```

Custom caps are unchanged by `wpdev_admin_capability_for()` — still call it for consistency with Form_Manager.

## Modal Response Contracts (`wubox.js`)

When a wubox modal form submits via Ajax, `wubox.js` handles the JSON response based on the top-level keys inside `response.data`:

| Response Key | Type | Behavior | Best Used For |
|---|---|---|---|
| `redirect_url` | `string` | Unblocks form and navigates: `window.location.href = redirect_url`. | Standalone CRUD list creates, standalone delete, or root entity updates. **Never use for child sub-entities on an `Edit_Admin_Page`!** |
| `send` | `object` | Dispatches `wubox:send` CustomEvent, unblocks form, and invokes `window[send.scope][send.function_name](send.data, removeBox)`. | Sub-entity modals (line-items, segments, repeater rows) where changes must be updated in parent page memory without reloading. |
| `download_url` | `string` | Unblocks form, triggers background download via hidden iframe/anchor, and optionally shows success notice or alert (`close_modal: true`). | Exporting CSV, JSON, PDF reports from a modal form without page unload. |
| `tables` | `object` | Updates registered `Base_List_Table` JS instances: `window[tableName].update()`. | Modals that create/edit items from a list table view. |
| (none / empty) | — | Unblocks form and calls `removeBox()` to close modal. | Simple acknowledgment actions with no redirect. |

## Sub-Entity / Line-Item Modal Pattern on `Edit_Admin_Page`

When an `Edit_Admin_Page` allows creating or editing sub-entities (e.g. order line items, wheel prize segments, course curriculum steps, repeated schedule slots) via a modal form, **never prematurely persist the parent model to MySQL and never return `redirect_url`**.

### 1. The Anti-Pattern: Premature Persistence & Page Reload
Calling `$parent->save()` inside the child modal handler and returning `redirect_url`:
- Prematurely persists the parent entity to MySQL before the user clicks the primary "Save" button of the edit page.
- Forces a full browser reload, obliterating any unsaved edits in other tabs, metaboxes, or fields of the parent form.
- Violates atomic transaction boundaries (sub-entity edits become permanent even if the user cancels or navigates away).

### 2. The Solution: In-Memory `send` Contract + Atomic Save
1. **PHP Modal Handler:** Validate and sanitize the child data, build its canonical representation with `flatten_segment()` / `flatten_item()`, and return a `send` payload:
   ```php
   wp_send_json_success(
       array(
           'send' => array(
               'scope'         => 'myHostEditPage',
               'function_name' => 'onItemSaved',
               'data'          => array(
                   'index' => $index, // 0-based index or item ID
                   'item'  => $flattened_item,
               ),
           ),
       )
   );
   ```

2. **Client-side JS Receiver:** Define the callback in your host script:
   ```javascript
   window.myHostEditPage = window.myHostEditPage || {};
   window.myHostEditPage.onItemSaved = function (data, closeModal) {
       var app = getVueApp(); // window.wpdev_advanced or root Vue instance
       if (app && Array.isArray(app.items)) {
           var idx = parseInt(data.index, 10);
           if (idx >= 0 && idx < app.items.length) {
               // Update existing item reactively
               app.$set ? app.$set(app.items, idx, data.item) : app.items.splice(idx, 1, data.item);
           } else {
               // Push new item
               app.items.push(data.item);
           }
       }
       // Close modal cleanly without reload
       if (typeof closeModal === 'function') {
           closeModal();
       }
   };
   ```

3. **Re-Opening Synchronization (`wubox:load`):**
   If the user edits an item in the modal, closes it, and re-opens the modal *before* saving the parent post, `wpdev_form_display` fetches the modal HTML from MySQL (which contains stale database values). To prevent losing in-memory edits:
   ```javascript
   document.body.addEventListener('wubox:load', function () {
       setTimeout(function () {
           var modal = document.querySelector('#WUB_window form#my_edit_item_form');
           if (!modal) return;
           var idxInput = modal.querySelector('input[name="item_index"]');
           if (!idxInput) return;
           var idx = parseInt(idxInput.value, 10);
           var app = getVueApp();
           if (app && app.items && app.items[idx]) {
               // Sync inputs, checkboxes, and selectizers from in-memory state
               syncModalForm(modal, app.items[idx]);
           }
       }, 50);
   });
   ```

4. **Atomic Parent Persistence:**
   The parent edit screen renders hidden `<input>` fields from the reactive Vue items array. When the user finally clicks the primary "Save [Entity]" button of the parent page, WordPress / WPDev persists the parent entity and all its child line items in one atomic operation.

## SVG DOM Property Safety in Admin Scripts

In modern browsers (Chrome, Safari, Firefox), SVG DOM elements (`<svg>`, `<g>`, `<path>`, `<polygon>`, `<text>`) implement `className` as an instance of `SVGAnimatedString` with a **read-only getter**.
- **Fatal Mistake:** `svgElement.className = 'my-class';`
  - Throws `TypeError: Cannot set property className of #<SVGElement> which has only a getter` in strict mode.
  - Immediately aborts execution of the script bundle, causing subsequent lifecycle hooks (`wubox:load`, form bindings) to silently fail.
- **Safe Replacement:**
  ```javascript
  // Always use setAttribute or classList on SVG elements:
  svgElement.setAttribute('class', 'my-class my-class--modifier');
  // Or:
  svgElement.classList.add('my-class');
  ```

## Opening modals

- List/header links: `wpdev_get_form_url( 'form_id' )` + `classes => 'wubox'`
- Programmatic: `wpdev_modal_open( 'form_id', $args )`

Use `@framework/modules/form-builder/API_DOC.md` for discovery, then verify
the signature and behavior against the framework source; source wins when the
API document is stale.

## Reuse built-in `delete_modal` (before inventing a custom delete form)

1. Prefer the framework `delete_modal` (edit Delete widget / list row delete).
2. Map authorization with `wpdev_delete_modal_capability` — default `wpdev_delete_{$model}s` is a **phantom** cap no role has.
3. Resolve the object with `wpdev_get_{$model}( $id )` **or** filter `wpdev_delete_form_get_object_{$model}` (`$object, $id, $model`).
4. Object resolution ≠ authorization. Provide the object through the built-in
   getter **or** the object filter; the authorization mapping is separate.
5. Optional list redirect: `wpdev_data_json_success_delete_{$model}_modal`.

```php
add_filter( 'wpdev_delete_modal_capability', static function ( $capability, $model ) {
	return 'agent' === $model ? 'my_plugin_edit_agents' : $capability;
}, 10, 2 );

add_filter( 'wpdev_delete_form_get_object_agent', static function ( $object, $id, $model ) {
	return $object ? $object : my_plugin_get_agent( $id );
}, 10, 3 );
```

Do **not** re-register `delete_modal` via `wpdev_register_form()` to change capability — first registration wins. Full diagnosis: [form-not-available.md](form-not-available.md) §3b.

## Setup-unfinished and late-host fallback


When WPDev setup is unfinished, normal lifecycle hooks may not fire. Attach every form callback first, then use one narrow host-level fallback:

```php
if ( function_exists( 'wpdev_services' ) && ! did_action( 'wpdev_register_forms' ) ) {
    do_action( 'wpdev_register_forms' );
}
```

Do not fire this action before all host callbacks are attached. If the action already fired, do not fire it again globally; call only the late component's idempotent `register()` method.

For diagnosis and end-to-end verification, read [form-not-available.md](form-not-available.md).

## Custom Post Type (`Post_Edit_Admin_Page`) Integration

When building admin metaboxes on native WordPress post types (`Post_Edit_Admin_Page`), modal forms can be registered by overriding the `register_forms()` method:

```php
class Project_Post_Edit_Page extends Post_Edit_Admin_Page {
    public function register_forms(): void {
        wpdev_register_form( 'quick_add_industry', array(
            'render'     => array( $this, 'render_modal' ),
            'handler'    => array( $this, 'handle_modal' ),
            'capability' => 'manage_categories',
        ) );
    }
}
```

`Post_Edit_Admin_Page` automatically hooks `wpdev_register_forms` during construction (with a safe `did_action` fallback) and automatically enqueues `wpdev-vue-apps` inside `register_meta_boxes()` so `wubox.js` is fully primed on CPT screens.

## Built-in Generic Taxonomy Quick-Add (`wpdev_quick_add_term`)

WPDev provides a built-in modal form `wpdev_quick_add_term` out-of-the-box. Any multi-checkbox or select field can trigger it by configuring:

```php
'quick_add' => array(
    'label'    => __( '+ Add Term', 'my-plugin' ),
    'form'     => 'wpdev_quick_add_term',
    'taxonomy' => 'my_taxonomy',
),
```

The built-in handler verifies taxonomy existence and `manage_categories` capabilities, creates the term, and dispatches a DOM event that dynamically inserts the new option into the multiselect without page reloads.
