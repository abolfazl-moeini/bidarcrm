# List / grid modes and card columns

**Source:** `@framework/modules/table-builder/src/table/class-base-list-table.php`

| API / property | Purpose |
|----------------|---------|
| `public $modes = array( 'list' => 'List', 'grid' => 'Grid' );` | Enables list/grid switcher in the filter bar |
| `single_row_grid( $item )` | Host **must** override; base method is empty |
| `column_customer()` / `column_product()` / `column_payment()` | Card markup helpers on the base class — copy/adapt patterns, do not hard-depend on example models |
| Filter bar view switcher | Framework template `base/filter` |

**Write target:** host plugin list table class.

## Enable modes

Default is list-only:

```php
public $modes = array( 'list' => 'List' );
```

To offer grid:

```php
public $modes = array(
	'list' => __( 'List', 'textdomain' ),
	'grid' => __( 'Grid', 'textdomain' ),
);
```

## Implement `single_row_grid()` in the host

The base class ships an empty body. **You must implement grid markup in the host table:**

```php
public function single_row_grid( $item ) {
	// Output one card for $item (escape all output).
	// Optionally adapt structure from base column_* card helpers
	// (column_customer / column_product / column_payment) without requiring @examples.
	?>
	<div class="wpdev-card">
		<strong><?php echo esc_html( $item->get_name() ); ?></strong>
		<!-- host-specific card body -->
	</div>
	<?php
}
```

## STOP gates

- Do **not** require installing `wpdev-examples/customers` (or any example) to implement grid.
- Adapt base helpers and host domain models only.
- Keep ajax capability aligned with the page (`user_can_ajax_refresh()` override for site-admin caps).

## Optional deeper reading

If the separate examples repo is installed, customer/product grid cards under `@examples/` are optional visual references only — never a hard dependency for production panels.
