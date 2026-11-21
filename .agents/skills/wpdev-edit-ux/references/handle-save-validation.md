# `handle_save()` validation, notices, and JSON assembly

**Source:** `@framework/modules/admin-page-builder/src/admin/class-edit-admin-page.php` (`handle_save()`, notices on failure).

**Write target:** host plugin `Edit_Admin_Page` subclass.

## 1. Verify access & stay on the page on failure

Always verify write permissions using the Two-Gate Access Service (`wpdev_can` or `wpdev_require_access`) before performing mutations:

```php
public function handle_save() {
	$item_id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;

	// Enforce Two-Gate access check on mutation:
	if ( function_exists( 'wpdev_can' ) && ! wpdev_can( 'my_plugin.items.edit', array( 'item_id' => $item_id ) ) ) {
		wpdev_add_admin_notice( __( 'You do not have permission to edit this item.', 'textdomain' ), 'error', 'admin' );
		return false;
	}

	// … validate …
	if ( is_wp_error( $errors ) || ! empty( $errors ) ) {
		// 'admin' for site-admin pages; 'network-admin' for network SaaS screens
		wpdev_add_admin_notice( $message, 'error', 'admin' );
		return false;
	}

	return parent::handle_save();
}
```

Framework default notices often use `'network-admin'`. Match the **actual** panel context of the host page.

## 2. Complex assembly before `parent::handle_save()`

For typed Advanced Options / sectioned config:

1. Sanitize typed `$_POST` fields (`sanitize_text_field`, `absint`, etc.).
2. Assemble structured arrays (segments, limits, theme config, …).
3. Validate with domain rules (required keys, ranges, uniqueness).
4. Encode to **string JSON** when model setters expect strings.
5. Then call `parent::handle_save()` (or assign attributes and save yourself if the base path is insufficient).

```php
public function handle_save() {
	$raw_segments = isset( $_POST['segments'] ) ? wp_unslash( $_POST['segments'] ) : array();
	// sanitize each row …
	$segments = /* sanitized array */;

	if ( empty( $segments ) ) {
		wpdev_add_admin_notice( __( 'Add at least one segment.', 'textdomain' ), 'error', 'admin' );
		return false;
	}

	// Model column expects a JSON string — do not leave a PHP array in $_POST:
	$_POST['segments'] = wp_json_encode( $segments );

	return parent::handle_save();
}
```

## 3. Merge-on-save for sectioned JSON models

When the model stores a JSON blob with multiple sections and the form only edits **some** keys:

**Merge** POST-assembled sections with existing decoded data so unknown / future keys are preserved.

```php
$existing = json_decode( (string) $object->get_config(), true );
if ( ! is_array( $existing ) ) {
	$existing = array();
}

$incoming = array(
	'segments' => $segments,
	// only keys this form owns
);

$merged = array_replace_recursive( $existing, $incoming );
$_POST['config'] = wp_json_encode( $merged );
```

## 4. PHP 7.4 TypeError trap

Never put decoded arrays into `$_POST` keys that model setters type-hint or cast as **JSON strings**. Encoding before `attributes( $_POST )` / `parent::handle_save()` avoids fatal TypeErrors.

## Rules

- Write target = host edit page only.
- Re-check capabilities if the save path has elevated side effects.
- Prefer `wpdev_add_admin_notice()` (or `wpdev()->notices->add()`) over raw admin notices for WPDev chrome consistency. See [admin-notices.md](../../wpdev-panel-builder/references/admin-notices.md).
