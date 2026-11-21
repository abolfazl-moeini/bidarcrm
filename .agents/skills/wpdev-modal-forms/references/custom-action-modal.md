# Custom row action → ajax → result modal

Production webhooks use **SweetAlert2** for the response modal, not `wubox`. Document both mechanisms.

## 1. Row action (list table)

See `wpdev-list-ux/references/row-actions-ajax.md`.

## 2. Ajax handler registration

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/webhooks/src/managers/class-webhook-manager.php`

Framework default: `skip_nonce` is **false**. Source: `@framework/modules/core/src/functions/ajax.php` (`wpdev_wrap_ajax_handler_callback`).

```php
wpdev_register_ajax_handler(
	'wpdev_send_test_event',
	array( $this, 'send_test_event' ),
	array(
		'access' => 'my_plugin.webhooks.test', // Two-Gate access ID (Gate 1 WP cap + Gate 2 domain policy)
		// do NOT set skip_nonce for privileged admin actions
	)
);
```

> **WARNING — never copy `skip_nonce => true` for privileged admin actions.**
>
> Skipping the nonce opens a CSRF risk. Keep the default (`skip_nonce` omitted / false). The client must send the WPDev ajax nonce (`nonce_action` default `wpdev-ajax-nonce`, field `nonce`). Enqueue scripts with the `wpdev-ajax` dependency so the nonce is available, or pass it explicitly from `wp_create_nonce( 'wpdev-ajax-nonce' )`.
>
> Rare public/nopriv cases: only set `skip_nonce => true` when you document **why**, and still re-validate capabilities or signed tokens **inside** the handler.

**Read-only preview endpoints** (payload previews, log viewers — nothing is created,
updated, or deleted) are the one sanctioned `skip_nonce` pattern, because ported legacy
JS often cannot send a nonce. Pair it with a site-admin-aware capability gate:

```php
wpdev_register_ajax_handler(
	'my_preview_action',
	array( $this, 'render_preview' ),
	array(
		// skip_nonce: read-only preview; handler enforces capability itself.
		'skip_nonce'          => true,
		'capability_callback' => static function () {
			$cap = function_exists( 'wpdev_admin_capability_for' )
				? wpdev_admin_capability_for( 'manage_network' )
				: 'manage_network';

			return current_user_can( $cap );
		},
	)
);
```

**Symptom of a missing nonce:** the request returns 403 `Invalid security token`, and
if the JS only has a `success` callback the UI freezes on its loading state forever.
Full diagnosis: [ajax-stuck-loading.md](ajax-stuck-loading.md).

## 3. Handler

Optional source (if examples installed): `@examples/webhooks/src/managers/class-webhook-manager.php`

```php
public function send_test_event() {
	$webhook_id = (int) wpdev_request( 'webhook_id' );

	// Re-check Two-Gate access inside the handler:
	if ( function_exists( 'wpdev_can' ) && ! wpdev_can( 'my_plugin.webhooks.test', array( 'webhook_id' => $webhook_id ) ) ) {
		wp_send_json_error( array( 'response' => __( 'Permission denied.', 'textdomain' ) ), 403 );
		return;
	}

	// ... run action ...
	wp_send_json( array(
		'response' => htmlentities2( $response ),
		'id'       => $webhook_id,
	) );
}
```

Prefer `wpdev_ajax_success()` / `wpdev_ajax_error()` when using the light transport pattern elsewhere.

Always re-check authorization (`wpdev_can()` or `wpdev_require_access()`) inside the handler even when `'access'` is set on registration.

## 4. JS (SweetAlert2)

Optional source (if examples installed): `@examples/webhooks/assets/js/webhook-page.js`

Register script with `wpdev-sweet-alert` and `wpdev-ajax` dependencies so the nonce is present. If the script also mounts a Vue app (`new Vue(...)`), add `wpdev-vue` — a jquery-only dependency list lets the script run before Vue loads and the app never mounts.

```javascript
jQuery( document ).on( 'click', '#action_button', function ( event ) {
	event.preventDefault();
	jQuery.ajax( {
		method: 'post',
		url: ajaxurl,
		data: {
			action: jQuery( this ).data( 'action' ),
			webhook_id: jQuery( this ).data( 'object' ),
			// Include WPDev ajax nonce (field name defaults to "nonce"):
			nonce: ( window.wu_ajax && window.wu_ajax.nonce ) || ( window.wpdev_ajax && window.wpdev_ajax.nonce ) || '',
		},
		success( data ) {
			if ( data.response ) {
				Swal.fire( {
					title: 'Test Response',
					icon: 'success',
					html: '<pre>' + JSON.stringify( data.response, null, 2 ) + '</pre>',
					showCloseButton: true,
				} );
			}
		},
	} );
} );
```

If your host already localizes a nonce under a known handle, use that handle. Do not omit the nonce for privileged actions.

## Rules

- Never hand-roll `admin-ajax.php` outside `wpdev_register_ajax_handler()`.
- Never set `skip_nonce => true` for privileged admin actions.
- Handler always checks `current_user_can()` for the real page capability.
- SweetAlert2 = quick result popups; `wubox` = multi-field response forms.
- Requires user confirmation in Phase 2 unless action was explicitly requested.
