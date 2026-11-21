# Model + Database + Manager skeleton

Full domain module behind admin pages. Prefer the **inlined snippets below**. Optional deeper reading: `@examples/products/src/` when that separate repo is installed — see [SHARED-PATHS.md](../../SHARED-PATHS.md).

```bash
# Optional only
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

**Write** adapted classes into the **host plugin** using **your own PHP namespace and autoloading** (see [consumer-plugin-layout.md](consumer-plugin-layout.md)).

Do **not** copy `WPDevFramework\Models\*` / `WPDevFramework\Database\*` namespaces into a host plugin — those belong to `@examples/` / framework only.

## Layer responsibilities

| Layer | Class | Purpose |
|-------|-------|---------|
| DB table | `{Entities}_Table extends Table` | Physical table + `set_schema()` SQL upgrades |
| Schema | `{Entities}_Schema extends Schema` | Column metadata for Query (required by Query) |
| Query | `{Entity}_Query extends Query` | Filtering, collections |
| Model | `{Entity} extends Base_Model` | Domain behavior |
| Manager | `{Entity}_Manager extends Base_Manager` | REST, CLI, hooks |

## Host table rules (critical)

1. Host table class **must** set its own `$prefix` and `$name`.
2. Physical table is `{wpdb->prefix}{prefix}_{name}` (example: prefix `wheel` + name `configs` → `wp_wheel_configs`).
3. Do **not** rely on the framework default prefix `wu` unless you truly want `wu_*` tables.
4. **Table, Query, and Schema** must share the **same** host `$prefix` (framework default on all three is `wu`).
5. For host modules loaded **after** framework boot (`plugins_loaded` priority 6 is typical):
   - construct the table: `new My_Table();`
   - if needed, call `$table->install()` when `$table->exists()` is false and upgrade is allowed
   - keep using framework model/query classes with the **same** prefix/name
6. `wpdev_register_table()` may still be used when it matches framework timing (examples plugin / early modules). For late host plugins, **direct construction** is the safe default.
7. Multisite note: `Table::is_upgradeable()` is main-site/network oriented. If a host needs per-site tables on all subsites, stop and design that separately.

## DB table class (host-plugin namespaces)

```php
namespace My_Shop\Database\Products;

use WPDevFramework\Database\Engine\Table;

final class Products_Table extends Table {
    /**
     * REQUIRED for host plugins. Framework default is 'wu'.
     * Physical table: {$wpdb->prefix}shop_products
     */
    protected $prefix = 'shop';
    protected $name = 'products';
    protected $global = true;
    protected $version = '1.0.0';

    protected function set_schema() {
        $this->schema = "id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(191) NOT NULL DEFAULT '',
            PRIMARY KEY (id)";
    }
}
```

### Late host plugin — direct construction (safe default)

In host `setup.php` / manager `init()` (after classes autoload):

```php
$table = new \My_Shop\Database\Products\Products_Table();
if ( ! $table->exists() && $table->is_upgradeable() ) {
    $table->install();
}
```

### Early / examples-style timing — register factory

Only when registration happens **before** `Table_Loader` finishes booting (examples plugin / early modules):

```php
wpdev_register_table( 'product_table', \My_Shop\Database\Products\Products_Table::class );
```

Do **not** assume `wpdev_register_table()` alone creates the physical table for a host plugin that boots on `plugins_loaded` priority 6.

## Schema class (required by Query)

Query instantiates `$table_schema` at runtime (`class_exists` + `new`). Without this class, queries fail. Keep column definitions aligned with the Table `set_schema()` SQL.

```php
namespace My_Shop\Database\Products;

use WPDevFramework\Database\Engine\Schema;

class Products_Schema extends Schema {
    /** Must match Products_Table / Product_Query (framework default is 'wu') */
    protected $prefix = 'shop';

    public $columns = array(
        array(
            'name'     => 'id',
            'type'     => 'bigint',
            'length'   => '20',
            'unsigned' => true,
            'extra'    => 'auto_increment',
            'primary'  => true,
            'sortable' => true,
        ),
        array(
            'name'       => 'name',
            'type'       => 'varchar',
            'searchable' => true,
            'sortable'   => true,
        ),
        // Add one column entry per physical column in Products_Table::set_schema().
    );
}
```

## Query class

```php
namespace My_Shop\Database\Products;

use WPDevFramework\Database\Engine\Query;

class Product_Query extends Query {
    /** Must match Products_Table::$prefix (framework default is 'wu') */
    protected $prefix = 'shop';
    protected $table_name = 'products';
    protected $table_alias = 'p';
    protected $table_schema = '\\My_Shop\\Database\\Products\\Products_Schema';
    protected $item_name = 'product';
    protected $item_name_plural = 'products';
    protected $item_shape = '\\My_Shop\\Models\\Product';
}
```

## Model class

```php
namespace My_Shop\Models;

use WPDevFramework\Models\Base_Model;

class Product extends Base_Model {
    // domain fields and helpers
}
```

## Manager class

```php
namespace My_Shop\Managers;

use WPDevFramework\Managers\Base_Manager;

class Product_Manager extends Base_Manager {
    use \WPDevFramework\Traits\Singleton;

    protected $slug = 'product';
    protected $model_class = '\\My_Shop\\Models\\Product';

    public function init() {
        // hooks, REST, CLI — and optionally ensure table exists (see above)
    }
}
```

Boot (module id must match `Module_Loader::register()` / `mark_loaded()`):

```php
wpdev_boot_module_manager(
    'my-shop-products',
    \My_Shop\Managers\Product_Manager::class,
    __DIR__ . '/src/managers/class-product-manager.php'
);
```

## Data flow

1. Host bootstrap registers module + `setup.php` constructs/installs DB tables + registers pages + boots manager
2. List page → list table → query → models
3. Edit page → `get_object()` → single model
4. Manager handles integrations

## Common mistakes

1. Only calling `wpdev_register_table()` from a late host and assuming the table exists
2. Forgetting to override `$prefix` on **Table / Query / Schema** and shipping `wu_mything` by accident
3. Pointing Query at a Schema class that does not exist (or wrong FQCN)
4. Query `item_shape` mismatch with model class
5. Manager not booted in `setup.php`
6. Business logic in page classes instead of model/manager
7. Reusing `WPDevFramework\Models\*` namespaces in a host plugin (breaks autoload — host must autoload its own classes)

See [anti-patterns.md](anti-patterns.md).
