# Test scaffolding

**Before `composer install`:** set up private wpdev packages — see [private-packages.md](private-packages.md).

## Always create

### composer.json

```json
{
  "repositories": [
    {
      "type": "path",
      "url": "packages/*",
      "options": {
        "monorepo": true,
        "symlink": false
      }
    }
  ],
  "autoload": {
    "psr-4": {
      "{Vendor}\\{Plugin}\\": "./src/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "{Vendor}Test\\{Plugin}\\": "./tests/unit-tests/"
    }
  },
  "require-dev": {
    "phpunit/phpunit": "^9.6",
    "yoast/phpunit-polyfills": "^1.1",
    "wpdev/plugin-core-test": "^1.2"
  },
  "scripts": {
    "tests": "phpunit"
  }
}
```

**Namespace rule:** append `Test` to the first segment (`WPDev\Core\Rest` → `WPDevTest\Core\Rest`).

### Toolchain constraints (do not "modernize")

| Component | Constraint | Why |
|-----------|-----------|-----|
| PHPUnit | **9.x recommended** (`^9.6`), compatible with 10+ | `WPDevTest\TestCases\BaseTestCase::expectFilter()` bridges `addMethods()` and `setMethods()` across PHPUnit 9-11 |
| `yoast/phpunit-polyfills` | Required | WordPress ≥ 5.9 test bootstrap aborts without it |
| WordPress | ≥ 5.9 | Package test cases declare `setUp(): void` / `tearDown(): void` |
| PHP | 7.4 – 8.1 | Matches the bundled Docker image (`wordpress:php8.1-apache`) |


If a run reports a polyfills version error, match the constraint in your `wordpress-develop` checkout's own `composer.json` instead of guessing.

**Optional require-dev** (add only when the package was copied to `packages/`):

- `wpdev/wc-core-test` — WooCommerce test helpers (also add `woocommerce/woocommerce.php` to `tests/plugins-list.php`)

**Optional:** add `"files": [ "tests/unit-tests/functions.php" ]` under `autoload-dev` for global function stubs (e.g. `bf_asset_info`) loaded in every test run — only when tests need them.

**Optional patches:** only if the project has `tests/patch/apply-patches.php`, add:

```json
"scripts": {
  "tests": "phpunit",
  "tests:pre": "@php ./tests/patch/apply-patches.php"
}
```

Do **not** add `tests:pre` by default. Missing patch files break `composer` scripts.

For merging into an existing `composer.json`, see [private-packages.md](private-packages.md).

### phpunit.xml.dist

Copy this structure; replace placeholders. Do **not** use a personal machine path.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit
        bootstrap="tests/unit-tests/bootstrap.php"
        backupGlobals="false"
        colors="true"
        convertErrorsToExceptions="true"
        convertNoticesToExceptions="true"
        convertWarningsToExceptions="true"
        executionOrder="random"
        verbose="true"
>
    <testsuites>
        <testsuite name="plugin">
            <directory suffix="Test.php">./tests/unit-tests/</directory>
            <exclude>./tests/unit-tests/TestCases</exclude>
            <exclude>./tests/unit-tests/vendor</exclude>
        </testsuite>
    </testsuites>

    <php>
        <includePath>.</includePath>
        <env name="stage" value="development"/>
        <env name="db" value="wpdev-test"/>

        <env name="WP_TESTS_DIR" value="{wordpress-develop}/tests/phpunit"/>
        <env name="BOOTSTRAP_FILE"
             value="{wp-root}/wp-content/plugins/{plugin-slug}/{main-file}.php"/>
        <env name="PLUGIN_ROOT" value="{wp-root}/wp-content/plugins/{plugin-slug}"/>

        <!-- Only when tests need other plugins: -->
        <!-- <env name="ACTIVE_PLUGINS" value="tests/plugins-list.php"/> -->
        <!-- <env name="WPML_ENABLED" value="1"/> -->
    </php>

    <coverage processUncoveredFiles="true">
        <include>
            <directory suffix=".php">src</directory>
        </include>
    </coverage>
</phpunit>
```

**Coverage element:** use `<coverage>` (PHPUnit 9.3+). The older `<filter><whitelist>` form still runs on 9.6 but prints deprecation warnings on every invocation.

Replace:

| Placeholder | Meaning |
|-------------|---------|
| `{Vendor}` | First PSR-4 namespace segment of the plugin (tests use `{Vendor}Test`) |
| `{Plugin}` | Second namespace segment (plugin name) |
| `{wordpress-develop}` | Absolute path to a [wordpress-develop](https://github.com/WordPress/wordpress-develop) checkout |
| `{wp-root}` | WordPress root used to load the plugin (often `{wordpress-develop}/src` or a local site root) |
| `{plugin-slug}` | Plugin directory name |
| `{main-file}` | Main plugin PHP file without path |

**Why `suffix="Test.php"`:** discovers `FooTest.php` only. Avoids loading `bootstrap.php` and abstract bases under `TestCases/` as tests.

**Random order:** keep `executionOrder="random"`. Reproducible failure: pass `--random-order-seed=<printed-seed>` when PHPUnit reports a seed.

### Env vars → bootstrap wiring

`WPDevTest\Setup::setup()` reads `<env>` values from phpunit at runtime:

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `WP_TESTS_DIR` | WordPress PHPUnit includes | **Yes** — setup throws if missing |
| `BOOTSTRAP_FILE` | Main plugin PHP file to load | **Required for plugin tests** — if unset, plugin main file is not loaded by Setup |
| `PLUGIN_ROOT` | Plugin root directory | Optional — Setup can sniff from paths; set it explicitly when possible |
| `ACTIVE_PLUGINS` | Path to `tests/plugins-list.php` | Only when other plugins must load |
| `ALL_PLUGINS_ROOT` | Directory holding sibling plugins; becomes the `ALL_PLUGINS_DIR_ABS` constant that `plugins-list.php` builds paths from | Only when other plugins must load — defaults to `dirname( PLUGIN_ROOT )`, which is wrong when the plugin is mounted on its own (Docker) |
| `WPML_ENABLED` | Load WPML mock via `WPDevTest\WPML::init()` | Optional |
| `stage`, `db` | Project-specific | Optional |

Do **not** hardcode these paths in `bootstrap.php` — configure them in `phpunit.xml.dist` (Docker overrides `WP_TESTS_DIR` via the shell).

### tests/unit-tests/bootstrap.php

**Fixed skeleton — always use this:**

```php
<?php

declare( strict_types=1 );

require dirname( __DIR__, 2 ) . '/vendor/autoload.php';

WPDevTest\Setup::setup( static function () {
    // Plugin-specific setup (optional) — see below
} );
```

Do **not** invent a custom bootstrap that calls `sys_get_temp_dir()` or loads `includes/bootstrap.php` by hand unless you are debugging the package itself.

**Register custom factories here** — not in a base class `setUp()`. The factory is a process-wide static built by whichever test class random order runs first, so bootstrap is the only order-independent place ([factories.md](factories.md)):

```php
WPDevTest\Setup::setup( static function () {

    add_action( 'WPDevTest/Factory', static function ( $factory ) {
        // Replace VendorTest\Plugin with your test namespace ({Vendor}Test\{Plugin}).
        $factory->item = new \VendorTest\Plugin\Factory\ItemFactory( $factory );
    } );
} );
```

**Optional blocks** (before or inside the callback):

```php
// When uninstall / WC data cleanup matters in tests:
define( 'WP_UNINSTALL_PLUGIN', true );
define( 'WC_REMOVE_ALL_DATA', true );

// Inside Setup::setup callback:
add_filter( 'WPDev/Core/RequestMock', '__return_empty_array', 1 );

// Custom DB tables — install fresh each run:
// Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
foreach ( [ \Vendor\Plugin\Model\FooModel::class ] as $model_class ) {
    $model = new $model_class();
    $model->uninstall();
    $model->install();
}
```

## Create only when needed

### tests/plugins-list.php

Return an array of plugin paths relative to `wp-content/plugins/`:

```php
<?php

return [
    'woocommerce/woocommerce.php',
    'user-switching/user-switching.php',
];
```

Reference in phpunit: `<env name="ACTIVE_PLUGINS" value="tests/plugins-list.php"/>`.

Do **not** create this file for plugins with no external plugin dependencies.

## Running tests

```bash
# 1. Copy packages from skill — see private-packages.md
# 2. composer install
# 3. Set WP_TESTS_DIR, BOOTSTRAP_FILE, PLUGIN_ROOT in phpunit.xml.dist
composer tests
# Optional: composer tests:pre   # only if tests/patch/apply-patches.php exists
```

### Verify after scaffold

```bash
test -f vendor/bin/phpunit
./vendor/bin/phpunit --version | grep -Eq '^PHPUnit 9\.'
test -d vendor/yoast/phpunit-polyfills                          # required by WP >= 5.9
python3 - <<'PY'
import xml.etree.ElementTree as ET

root = ET.parse( 'phpunit.xml.dist' ).getroot()
assert root.get( 'executionOrder' ) == 'random'
assert any(
    node.get( 'suffix' ) == 'Test.php'
    for node in root.findall( './testsuites/testsuite/directory' )
)
env_names = { node.get( 'name' ) for node in root.findall( './php/env' ) }
assert { 'WP_TESTS_DIR', 'BOOTSTRAP_FILE', 'PLUGIN_ROOT' } <= env_names
print( 'phpunit.xml.dist: OK' )
PY
```

All checks must succeed before writing feature tests.
