# List views and ajax tabs

Requires `'ajax' => true` in the list table constructor. Views filter via query arg (e.g. `type`, `status`).

## Prefer helper — simple status/type tabs

When `Base_List_Table` `_get_items()` filtering via `extra_query_args` (`status`, `type`) is enough, use `self::declarative_filter_views( $field, $labeled_values )`.

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/memberships/src/tables/class-membership-list-table.php:194-205`

Framework: `@framework/modules/table-builder/src/table/class-base-list-table.php:173-194` (helper), `:460-486` (`extra_query_args`).

```php
'views' => self::declarative_filter_views(
    'status',
    array(
        'all'       => __( 'All Memberships', 'wpdev' ),
        'active'    => __( 'Active', 'wpdev' ),
        'pending'   => __( 'Pending', 'wpdev' ),
        'expired'   => __( 'Expired', 'wpdev' ),
        'cancelled' => __( 'Cancelled', 'wpdev' ),
    )
),
```

No `get_items()` override needed for the common WHERE-filter case.

## Hand-rolled views — custom query logic only

Use when a view needs a special data source (e.g. Sites "pending").

Optional source (if examples installed): `@examples/sites/src/tables/class-site-list-table.php:298-323`

```php
'views' => array(
    'all'            => array( 'field' => 'type', 'url' => add_query_arg( 'type', 'all' ), 'label' => __( 'All Sites', 'wpdev' ), 'count' => 0 ),
    'customer_owned' => array( 'field' => 'type', 'url' => add_query_arg( 'type', 'customer_owned' ), 'label' => __( 'Customer-Owned', 'wpdev' ), 'count' => 0 ),
    'site_template'  => array( 'field' => 'type', 'url' => add_query_arg( 'type', 'site_template' ), 'label' => __( 'Templates', 'wpdev' ), 'count' => 0 ),
    'pending'        => array( 'field' => 'type', 'url' => add_query_arg( 'type', 'pending' ), 'label' => __( 'Pending', 'wpdev' ), 'count' => 0 ),
),
```

`get_items()` reads `wpdev_request( 'type' )` and adjusts the query:

Optional source (if examples installed): `@examples/sites/src/tables/class-site-list-table.php:64-97`

```php
public function get_items( $per_page = 5, $page_number = 1, $count = false ) {
    $type = wpdev_request( 'type' );
    if ( $type === 'pending' ) {
        $pending = My_Entity::get_all_by_type( 'pending' ); // domain-specific source
        return $count ? count( $pending ) : $pending;
    }
    $query = array(
        'number' => $per_page,
        'offset' => ( $page_number - 1 ) * $per_page,
        'count'  => $count,
        'search' => wpdev_request( 's' ),
    );
    if ( $type && $type !== 'all' ) {
        $query['meta_query'] = array(
            'type' => array( 'key' => 'my_type', 'value' => $type ),
        );
    }
    return my_get_entities( $query );
}
```

## Ajax wiring (required)

Views click through `list-tables-factory.js` → `wpdev_list_table_fetch_ajax_results`.
That request never loads `List_Admin_Page::page_loaded()`, so the host must
early-register each ajax table id on module boot:

```php
\WPDevFramework\Ajax::register_list_table( 'mylisttable', My_List_Table::class );
```

> **Warning:** The first argument must be the exact DOM table ID (`$table->get_table_id()`, which defaults to lowercase class basename e.g. `'mylisttable'`), **not** the admin page menu slug (e.g. `'my-plugin-items'`). The frontend sends `data-table-id`, which causes `list_table_unresolved` if registered under the menu slug.

Also override `user_can_ajax_refresh()` to the page capability. See
[declarative-table-config.md](declarative-table-config.md#ajax-refresh-traps-required-host-wiring).

## Rules

- Default to `declarative_filter_views()` for simple status/type tabs.
- Hand-roll `views` + `get_items()` override only when a view needs custom logic.
- Early-register ajax table ids on module boot whenever `'ajax' => true`.
- Propose views/tabs in orchestrator Phase 2; implement only if user confirms or already specified filter dimensions.
