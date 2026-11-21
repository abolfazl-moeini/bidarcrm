# Debugging “stuck on Loading …” (ajax widget never resolves)

A metabox/widget that renders a blinking “Loading …” placeholder (payload previews, log
viewers, dashboard KPIs) and never resolves has one of **three** recurring root causes.
All three have shipped as real regressions more than once — check them in this order
before writing any new code.

## Symptom → cause map

| Observation | Root cause | Section |
|-------------|-----------|---------|
| Network tab: request returns **403** `Invalid security token` | JS sends no nonce, handler registered with default `skip_nonce => false` | §1 |
| Network tab: request succeeds but `data` is empty / “No X was selected” | Registry never populated — callback attached to a hook that already fired | §2 |
| Network tab: **no request at all**; both loading and content markup visible | Vue app never mounted — script missing `wpdev-vue` dependency | §3 |
| Network tab: returns HTML `<br /><b>Notice...` before `{` | PHP notice/warning printed to stdout; JSON parser throws SyntaxError (`xhr.responseJSON` is `undefined`) | §5 |

Also check: jQuery `$.ajax` calls written with **only a `success` callback** silently
swallow 403/500 responses — the spinner stays forever with no console error. Always add
an `error` callback (or use `.always()`) so failures surface.

## §1 Nonce mismatch (403)

`wpdev_register_ajax_handler()` enforces `check_ajax_referer( 'wpdev-ajax-nonce', 'nonce' )`
by default (`skip_nonce => false`). JS ported from legacy plugins (plain `wp_ajax_`
handlers, e.g. Ultimo) typically posts `{ action, ...data }` with **no nonce field**,
or still sends WordPress’s legacy `_ajax_nonce` with a **custom** action string
(e.g. `wpdev_activity_stream`) — the wrapper responds 403 before your handler runs.
The field name and nonce action both must match the framework defaults (`nonce` +
`wpdev-ajax-nonce`), not `_ajax_nonce` + a per-widget action.

Fix — pick exactly one:

**A. Send the nonce (preferred for privileged/mutating actions):**

```javascript
data: {
    action: 'my_action',
    nonce: ( window.wpdev_ajax && window.wpdev_ajax.nonce ) || '',
    // ...
},
```

Script must declare the `wpdev-ajax` dependency so the localized nonce exists.

**B. Read-only endpoint — skip the nonce but keep a capability gate:**

Only for endpoints that read/preview data and change nothing. Document why, and make
the capability site-admin aware:

```php
wpdev_register_ajax_handler(
	'my_preview_action',
	array( $this, 'render_preview' ),
	array(
		// skip_nonce: read-only preview; legacy JS sends no nonce and the
		// handler enforces its own capability check.
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

The handler must still re-check authorization internally. Never use option B for
actions that create, update, or delete anything — see
[custom-action-modal.md](custom-action-modal.md) for the CSRF warning.

## §2 Dead lifecycle hook (empty registry)

Managers boot on `wpdev_load`, which fires **inside** `plugins_loaded`. An
`add_action( 'plugins_loaded', ... )` from a manager’s `init()` attaches to a
hook that already fired — the callback **never runs**, the registry (event
types, forms, options for a select) stays empty, and the widget has nothing to
render. `init` has not fired yet at that point. For the default light-Ajax
transport (`wpdev-when` unset), the request is processed at
`plugins_loaded` priority 20 and terminates before `init`, so an
`init`-registered registry is empty for the whole request. Use the WPDev hooks
for those registries; this is also anti-pattern #25 in
[anti-patterns.md](../../wpdev-panel-builder/references/anti-patterns.md).
Anti-pattern #52 documents the related transport-side fix for selectizer
requests.

```php
// BROKEN — plugins_loaded already fired when this manager booted:
add_action( 'plugins_loaded', array( $this, 'register_all_things' ) );

// FIXED — stay inside the WPDev lifecycle; late priority lets other
// managers contribute their entries first:
add_action( 'wpdev_load', array( $this, 'register_all_things' ), 20 );
```

Diagnose from CLI in the failing site’s context:

```php
var_dump( did_action( 'wpdev_load' ) );                    // should be 1
var_dump( has_action( 'plugins_loaded', $callback ) );     // suspicious if truthy
var_dump( count( wpdev_get_event_types() ) );              // or the relevant registry
```

If `has_action` shows the callback still parked on `plugins_loaded` after boot, it is
dead. Same family as the “Form not available” lifecycle failure — see
[form-not-available.md](form-not-available.md) §4.

## §3 Missing Vue dependency (no request fired)

Widgets whose template uses `v-show` / `v-cloak` / `v-html` are mounted by a page
script calling `new Vue(...)`. If that script only declares `jquery` as a dependency,
it can execute before Vue loads — the app never mounts, `mounted()` never fires the
ajax call, and both the loading placeholder and the (v-cloak-hidden) content stay
frozen.

```php
// BROKEN:
wp_register_script( 'my-page', $url, array( 'jquery' ) );

// FIXED — declare every runtime the script actually uses:
wp_register_script( 'my-page', $url, array( 'jquery', 'wpdev-vue', 'wpdev-ajax' ) );
```

Add `wpdev-block-ui` when the script calls `wpdev_block_ui()`, `wpdev-sweet-alert`
when it calls `Swal.fire()`.

## §4 `wp_kses_post` stripped Vue directives (app mounts, Loading stays)

Symptom: `[data-wpdev-app]` exists, `window.wpdev_<app_id>` is set, scripts are
enqueued — but the blinking “Loading…” node never hides (often `display: flex`)
and tabs/fields look broken.

Cause: host code ran the rendered WPDev template through `wp_kses_post()` (or
another strict allow-list). Post kses allows `data-*` but **not** `v-show`,
`v-cloak`, `v-on:*`, `v-bind:*`. Tabs widgets put Loading behind
`v-show="false"`; without that attribute Vue cannot hide it.

```php
// BROKEN — PHPCS-happy, Vue-broken:
echo '<div class="wpdev-styling">' . wp_kses_post( $html ) . '</div>';

// FIXED — trusted WPDev admin markup; escape untrusted values at field level:
echo '<div class="wpdev-styling">' . $html . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WPDev Vue template.
```

Inspect in DevTools: if `innerHTML` of the app root has no `v-show` / `v-cloak`
after paint, kses (or a similar sanitizer) is the culprit — not a missing script.

Also listed as anti-pattern #58 in
[anti-patterns.md](../../wpdev-panel-builder/references/anti-patterns.md).

## §5 PHP Notice / Warning prepended to AJAX response (corrupted JSON & `error: undefined`)

Symptom: In browser DevTools Network tab, the request returns 200 OK or 500, but the response Preview/Response begins with HTML markup such as:
`<br /><b>Notice</b>: Object of class WC_Order could not be converted to int...<br />{"success":true,"data":...}`
The UI error dialog reports: `خطا در حین اجرا: undefined` or crashes with `SyntaxError: Unexpected token '<', "<br /><b>Notice"... is not valid JSON`.

Cause: In PHP 8+, converting an object to integer or accessing undefined properties emits a notice. When `display_errors` is enabled on the server or third-party plugins emit warnings, PHP writes them directly to standard output. When `wp_send_json_success()` / `wp_send_json_error()` runs, the JSON payload is prepended with HTML, corrupting the JSON response. Client jQuery fails to parse it as JSON, leaving `xhr.responseJSON` `undefined`.

Fix — apply two-sided defense:

**A. Server-side (PHP): Suppress display_errors & clear buffers:**
```php
public static function ajax_handle_batch(): void {
	check_ajax_referer( 'my_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
	}

	// Suppress inline error display for clean JSON delivery:
	@ini_set( 'display_errors', '0' );

	// Clean output buffer before sending JSON:
	if ( ob_get_length() ) {
		ob_clean();
	}
	wp_send_json_success( $result );
}
```

Also verify that entity loaders unwrap objects before integer comparisons or JSON encoding:
```php
$order_id = ( $res instanceof \WC_Order ) ? (int) $res->get_id() : (int) $res;
```
See anti-patterns #89 and #90 in [anti-patterns.md](../../wpdev-panel-builder/references/anti-patterns.md).

**B. Client-side (JS): Resilient JSON parser:**
```javascript
function parseAjaxResponse(res) {
	if (typeof res === 'object' && res !== null) return res;
	if (typeof res === 'string') {
		var jsonStart = res.indexOf('{');
		var arrayStart = res.indexOf('[');
		var start = -1;
		if (jsonStart !== -1 && arrayStart !== -1) start = Math.min(jsonStart, arrayStart);
		else if (jsonStart !== -1) start = jsonStart;
		else if (arrayStart !== -1) start = arrayStart;
		if (start !== -1) {
			try { return JSON.parse(res.substring(start)); } catch(e) {}
		}
	}
	return null;
}
```
And in AJAX error handlers, never do `alert(xhr.responseJSON.data.message)` without checking `xhr.responseJSON`. Fall back to `xhr.responseText` or generic error string.

## §6 Modal form download / non-navigating redirect deadlock (wubox.js)

When a WUBox modal form is submitted:
- `blocked_form = wpdev_block_ui(form)` freezes the form and displays a loading spinner.
- If the backend returned `redirect_url` pointing to a file download (or non-navigating response), the browser remained on the current page without unloading, while `blocked_form.unblock()` was never called, deadlocking the modal in a permanent loading state.

### Solution & Contracts
1. **First-class `download_url` contract (preferred):**
   ```php
   wp_send_json_success( array(
       'download_url' => admin_url( 'admin-ajax.php?action=my_download&nonce=...' ),
       'message'      => __( 'Report downloaded successfully!', 'my-plugin' ), // optional: notice in form or alert
       'close_modal'  => true, // optional: true to close modal, false/omitted to keep open
   ) );
   ```
   `wubox.js` automatically unblocks the form, triggers the file download in the background via a hidden iframe (or hidden anchor for blob/data URLs), displays the success notice/alert, and closes the modal if `close_modal: true`.
2. **`redirect_url` fail-safe:**
   `wubox.js` now calls `blocked_form.unblock()` immediately before executing `window.location.href = response.data.redirect_url;`. Even if a developer routes a file download through `redirect_url`, the form overlay will never deadlock.

## Regression checklist

- [ ] Every `$.ajax` to a `wpdev_register_ajax_handler` action sends `nonce`, **or** the handler explicitly sets `skip_nonce => true` with a documented reason + capability gate
- [ ] jQuery ajax calls have an `error`/`always` callback that clears the loading state
- [ ] No re-hook of `plugins_loaded` inside code that boots on `wpdev_load` /
      `wpdev_init`; do not defer a default light-Ajax registry to `init`
      because that request terminates before `init`
- [ ] Registry that feeds the widget is non-empty in a CLI probe
- [ ] Page script declares `wpdev-vue` (and `wpdev-block-ui` / `wpdev-sweet-alert` when used)
- [ ] Do not wrap `wpdev_get_template` / Form / tabs widget HTML in `wp_kses_post`
- [ ] AJAX handlers suppress `display_errors` (`@ini_set('display_errors', '0')`) and clean buffer `ob_clean()` before `wp_send_json_*`
- [ ] Batch/migration JavaScript decodes responses resiliently and guards against `undefined` `responseJSON`
- [ ] Modal file downloads use `download_url` instead of hijacking `redirect_url`
- [ ] End-to-end: authenticated request to the ajax action returns `success: true` with real data
