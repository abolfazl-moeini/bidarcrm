# Declarative table config + standard row actions

**Source (verify before extending):**

- `@framework/modules/table-builder/src/table/class-base-list-table.php` — `declarative_table_config()`, `declarative_filter_views()`, `standard_row_actions_for()`, `user_can_ajax_refresh()`
- Framework doc: `@framework/docs/modularization/table-declarative-config.md`
- Minimal examples: `@framework/modules/table-builder/examples/example-01.php`, `example-02.php`

**Write target:** host plugin list table class (extends `Base_List_Table`).

## `declarative_table_config()`

Return an array (or `null` to skip). Common keys: `columns`, `views`, `empty_state`, `actions`, `bulk_confirm`.

```php
public static function declarative_table_config() {
	return array(
		'empty_state' => array(
			'message'     => __( "You don't have any Items yet.", 'textdomain' ),
			'sub_message' => __( 'Create your first item to get started.', 'textdomain' ),
			'link_label'  => __( 'Add Item', 'textdomain' ),
		),
		'views' => self::declarative_filter_views(
			'status',
			array(
				'all'      => __( 'All', 'textdomain' ),
				'active'   => __( 'Active', 'textdomain' ),
				'inactive' => __( 'Inactive', 'textdomain' ),
			)
		),
	);
}
```

Prefer the schema helper when you also declare columns:

```php
public static function declarative_table_config() {
	return self::declarative_schema(
		array( 'cb', 'name', 'status', 'id' ),
		array(
			'views'       => self::declarative_filter_views( 'status', array(
				'all'    => __( 'All', 'textdomain' ),
				'active' => __( 'Active', 'textdomain' ),
			) ),
			'empty_state' => array(
				'sub_message' => __( 'Create your first item to get started.', 'textdomain' ),
			),
			'actions'     => array(
				'column' => 'name',
				'items'  => array( 'edit', 'delete' ),
			),
		)
	);
}
```

When `views` is in declarative config, you can omit a custom `get_views()` override.

## Advanced filter bar contract

Status/type tabs in declarative `views` are separate from advanced filter-bar
fields. `Base_List_Table::get_filters()` returns an empty array by default
(WPDev 2.8.6+). Override it only when the page needs advanced filter controls,
and always return an array:

```php
public function get_filters() {
	return array(
		'filters' => array(
			'owner_id' => array(
				'type'  => 'select',
				'title' => __( 'Owner', 'textdomain' ),
			),
		),
	);
}
```

Never return `false` or `null`: the filter renderer merges this value with its
template arguments.

For **visible GET filter forms** (report tables, custom data sources), do not
hand-write `<select>` / `<input type="date">`. Render a `WPDevFramework\UI\Form`
with `views => admin-pages/fields` and field types such as `model`, `text`
(Flatpickr datepicker), `hidden`, `submit`. Use `type => model` with
`data-model` set to a registered post type slug (e.g. `professors`, `page`) for
searchable CPT dropdowns — same selectizer contract as settings “Default
Registration Page”. Selectizer light-ajax must run at `init`
(`wpdev_ajax_url( 'init' )`) so theme-registered post types exist during
`post_type_exists()`. For dates use Flatpickr attrs (`wpdev-datepicker`,
`data-format`, `data-allow-time`; optional Jalali: `data-locale => fa`) — see
[datepicker.md](../../wpdev-edit-ux/references/datepicker.md).

**Dependent product filters** (`data-model => product`, optional
`data-include`): Selectizer `load()` only runs after the user types. To show a
scoped list on open (e.g. products for a selected professor), client-seed via
`selectize.addOption(...)` with the `#wpdev-template-product` fields
(`id`, `name`, `type`, `formatted_price`) then `refreshOptions(false)`. Updating
`data-include` alone does not populate the dropdown. See anti-pattern #54 in
[anti-patterns.md](../../wpdev-panel-builder/references/anti-patterns.md).

## Custom data sources (no BerlinDB `$query_class`)

Most host tables set `protected $query_class = '\\…\\Query'` and inherit
BerlinDB-backed `_get_items()` / schema helpers. When the list is backed by
something else (WordPress users, remote API, aggregated rows):

1. Leave `$query_class` unset (or empty).
2. Override `_get_items( $query_args )` (and usually `record_count()`).
3. Override `get_columns()` and `get_sortable_columns()` — do not rely on schema
   reflection.
4. Override `get_bulk_actions()` when Delete / Activate do not apply to the
   data source (return `array()`). Keep visibility `protected` (same as
   `WP_List_Table` / `Base_List_Table`) or widen to `public` — never narrower.
5. Register Ajax table ids via `WPDevFramework\Ajax::register_list_table()` when
   constructing the table early would pull in `WP_List_Table` outside admin.

Framework note (WPDev 2.8.6+): `get_schema_columns()` returns an empty array
when `query_class` is missing, so parent `get_bulk_actions()` no longer fatals.
Hosts should still override bulk actions for correct UX.

```php
final class StudentsListTable extends Base_List_Table {

	// No $query_class — users come from WP_User_Query.

	protected function get_bulk_actions() {
		return array(); // read-oriented list
	}

	protected function _get_items( $query_args ) {
		// … WP_User_Query …
	}
}
```

## Row actions helper

```php
public function column_name( $item ) {
	$actions = $this->standard_row_actions_for(
		$item,
		'model_slug',       // model slug used by delete modal / edit links
		'edit-page-id',     // edit admin page $id
		array( 'edit', 'delete' ) // optional defaults if declarative actions empty
	);

	// Merge custom actions after the helper:
	// $actions['test'] = '…';

	return sprintf(
		'<strong>%1$s</strong> %2$s',
		esc_html( $item->get_name() ),
		$this->row_actions( $actions )
	);
}
```

Supported standard slugs: `edit`, `delete`, `duplicate` (via `build_standard_row_actions()`).

## Table access control & AJAX refresh

### Canonical approach: `protected $access` (Recommended)

In modern WPDev, declare the named access ID directly on your `Base_List_Table` subclass:

```php
class My_List_Table extends Base_List_Table {
    /**
     * Named access ID evaluated by Access Service for table refresh and actions.
     *
     * @var string
     */
    protected $access = 'my_plugin.items.view';
}
```

`Base_List_Table::user_can_ajax_refresh()` automatically evaluates:

```php
if ( ! empty( $this->access ) && is_string( $this->access ) && function_exists( 'wpdev_can' ) ) {
    return (bool) wpdev_can( $this->access );
}
```

This enforces the **Two-Gate Defense-in-Depth Model**:
1. **Gate 1:** Checks the base capability configured in `wpdev_register_permission()`.
2. **Gate 2:** Checks any domain business rules/tenancy in `wpdev_register_access_policy()`.

### Legacy fallback (when `$access` is unset)

When `$access` is omitted, the base class falls back to `manage_network`:

```php
// @framework Base_List_Table fallback
$cap = function_exists( 'wpdev_admin_capability_for' ) ? wpdev_admin_capability_for( 'manage_network' ) : 'manage_network';
return current_user_can( $cap );
```

If not using the canonical `$access` property, site / WooCommerce hosts must override `user_can_ajax_refresh()` manually:

```php
public function user_can_ajax_refresh() {
	return current_user_can( 'manage_woocommerce' ); // or manage_options / page cap
}
```

## Rules

- Write only in the **host** list table class.
- Capabilities/nonce for custom row ajax: see `wpdev-modal-forms` (never `skip_nonce` for privileged actions).
- Do not require `@examples` to implement empty states or row actions.
