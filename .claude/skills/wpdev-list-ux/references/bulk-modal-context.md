# Bulk confirm modal — page context

`list-tables-factory.js` opens the bulk confirm wubox from `#doaction` / `#doaction2`. It keeps `bulk_action` + `bulk-delete[]`, sets `model`, then **re-attaches** the current page query string (view/source filters, `page`, `s`, …).

## Host rules

1. Drive list “views” with **URL query args** (e.g. `?price_edit_view=categories`), not only Vue/local state — the bulk modal URL is built from `window.location.search`.
2. Put durable filters in `get_hidden_fields()` / `display_ajax_filters()` when they must survive ajax refreshes; still keep them on the URL for bulk Apply.
3. If you must support an older framework build that strips context without re-attach, host `admin_footer` JS can wrap `wubox.show` and `url.searchParams.set( 'your_view_arg', … )` before open (Price Edit pattern).

## Confirm field name vs Vue state

Default bulk confirm toggle:

| Layer | Key |
|-------|-----|
| Form field `name` | `confirm` |
| Vue `v-model` / `data-state` | `confirmed` |

Handlers must read **`confirm`** (POST). Accepting `confirmed` as a fallback is fine; reading only `confirmed` always fails.

```php
$ok = wpdev_request( 'confirm' ) || wpdev_request( 'confirmed' );
if ( ! $ok ) {
	wp_send_json_error( new \WP_Error( 'confirmation_required', … ) );
}
```

Framework defaults: `@framework/modules/core/src/form/class-form-manager.php` (`render_bulk_action_form`).

## Host chrome anti-patterns (toggles + scroll)

1. **Do not `preventDefault()` / `stopPropagation()` on iOS toggle labels** (`.wpdev-tgl-btn`) inside `#WUB_ajaxContent`. That blocks native checkbox activation and leaves Vue `confirmed` false while the pill looks toggled — submit stays `v-bind:disabled="!confirmed"`.
2. Prefer letting Vue `v-model` own the toggle. If a host must sync state, assign `window.wpdev_true.confirmed` (form `data-wpdev-app="true"`) from the checkbox after the native `change` — do not invent a second preventDefault click path.
3. Extra gates beyond Confirm (e.g. host `reapply_action` select-icon) must be part of the same `v-bind:disabled` expression and covered in e2e; Confirm alone correctly leaves submit disabled when those gates are open.
4. When Confirm turns on and an extra gate is still empty, host chrome may scroll the gate into view and apply a **single** attention flash (Price Edit: `.wpdwoo-reapply-attention` on `.wpdwoo-reapply-action`) so the user notices the required choice — clear the class once the gate value is set.
5. `wubox.refresh()` runs from Vue `updated()`; framework preserves `#WUB_ajaxContent.scrollTop` (hosts on older builds may patch `wubox.refresh` the same way).

## Empty list + bulk chrome

`Base_List_Table::display()` wraps empty states in `data-table-id` (same as list mode) so Apply still binds. Hosts should not need a `display()` override for that after framework ≥ this fix.

## Table id / JS binding

`_get_js_var_name()` returns `$this->id` as-is (hyphens kept) so it matches `data-table-id`. Do not invent a second underscore id unless you override both sides together.
