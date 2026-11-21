# Test base classes

All plugin unit tests use **`wpdev/plugin-core-test`** (`WPDevTest\TestCases\*`). The package extends WordPress `WP_UnitTestCase` (or `WP_Ajax_UnitTestCase` for Ajax).

## Default rule

1. If `tests/unit-tests/TestCases/PluginBaseTestCase.php` is **missing** → **create it** (template below).
2. **Domain / feature tests** → extend `PluginBaseTestCase` or its children.
3. **Pure plugin bootstrap** (hooks, activation, no factories) → extend `WPDevTest\TestCases\TestCase` directly.

Never extend `WP_UnitTestCase` in plugin tests.

## Hierarchy (create per plugin)

```
WPDevTest\TestCases\TestCase
└── {Vendor}Test\{Plugin}\TestCases\PluginBaseTestCase
    ├── RestTestCase          ← only if you have REST handlers
    ├── AdminTestCase         ← extends PluginBaseTestCase, NOT package AdminTestCase
    └── …                     ← add more children only when needed

WPDevTest\TestCases\BaseAjaxTestCase    ← separate branch (WP_Ajax_UnitTestCase)
└── {Vendor}Test\{Plugin}\TestCases\BaseAjaxTestCase   ← optional thin wrapper (shared arrange only)
```

Do **not** invent base classes that are not listed above (no `PurchaseTestCase` unless you create and document it in the plugin).

## Package classes

| Class | Extends | Use when |
|-------|---------|----------|
| `TestCase` | `BaseTestCase` | Default; login, go_to, reflection helpers, factory |
| `BaseTestCase` | `WP_UnitTestCase` | `expectFilter()`, `expectAddAction()` only |
| `AdminTestCase` | `TestCase` | Package-only admin tests; plugins use their own `AdminTestCase` |
| `BaseAjaxTestCase` | `WP_Ajax_UnitTestCase` | `wp_ajax_*` handlers; `request()`, `ajax_action()` |
| `DBTestCase` | `TestCase` | Raw `$wpdb` / schema checks |
| `MultiLangTestCase` | `TestCase` | `wpml_object_id` without real WPML |
| `LibraryTestCase` | `TestCase` | Script enqueue; implement `handle_name()`, `version_parser()` |
| `WPDevTest\Woocommerce\Integration\TestCase` | `TestCase` | WooCommerce database / HPOS tests; auto-boots cart/session, safe teardown |
| `WPDevTest\Woocommerce\Unit\UnitTestCase` | `TestCase` | Pure in-memory WooCommerce unit tests with Brain Monkey and Mockery (no MySQL) |


Lifecycle overrides must remain `public function setUp(): void` and
`public function tearDown(): void`. In particular, `LibraryTestCase` declares
the `tearDown(): void` signature required by PHPUnit 9; do not omit the return
type in plugin subclasses.

## Plugin PluginBaseTestCase (create if missing)

Replace `{Vendor}` / `{Plugin}` with the plugin namespaces (test namespace = production first segment + `Test`).

**File:** `tests/unit-tests/TestCases/PluginBaseTestCase.php`

```php
<?php

declare( strict_types=1 );

namespace {Vendor}Test\{Plugin}\TestCases;

use WPDevTest\TestCases\TestCase;

abstract class PluginBaseTestCase extends TestCase {

	public function setUp(): void {

		parent::setUp();

		// Shared arrange for every domain test goes here.
	}
}
```

Create the class even when it is empty — domain tests need a stable base to extend, and children (`RestTestCase`, `AdminTestCase`) hang off it.

**Custom factories do not belong here.** `factory()` is a process-wide static built by whichever class random order runs first, so a `setUp()` registration is not guaranteed to run in time. Register the `WPDevTest/Factory` hook in `tests/unit-tests/bootstrap.php` instead — see [factories.md](factories.md).

## Plugin AdminTestCase

```php
<?php

declare( strict_types=1 );

namespace {Vendor}Test\{Plugin}\TestCases;

abstract class AdminTestCase extends PluginBaseTestCase {

	public function setUp(): void {
		parent::setUp();
		set_current_screen( 'edit' );
		$this->init();
	}

	abstract public function init(): void;
}
```

Override screen in `init()`:

```php
public function init(): void {
	set_current_screen( 'post' );
	// Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
	\Vendor\Plugin\Admin\Setup::setup();
}
```

## Plugin RestTestCase

Extend `PluginBaseTestCase`. Implement:

- `rest_handler_instance()` — handler singleton
- `init()` — boot related `Setup::instance()->init()`

`setUp()` builds `Spy_REST_Server`, runs `rest_api_init`. Use `$this->dispatch( $params, $login )` and `$this->request()`.

See [patterns-rest-ajax-http.md](patterns-rest-ajax-http.md).

## Plugin BaseAjaxTestCase wrapper

Root is always `WPDevTest\TestCases\BaseAjaxTestCase`. Add a thin plugin wrapper only when Ajax tests need shared arrange logic:

```php
<?php

declare( strict_types=1 );

namespace {Vendor}Test\{Plugin}\TestCases;

abstract class BaseAjaxTestCase extends \WPDevTest\TestCases\BaseAjaxTestCase {

	public function setUp(): void {

		parent::setUp();

		// Shared arrange for every Ajax test goes here.
	}
}
```

The Ajax base keeps its **own** static factory, separate from `TestCase`. Bootstrap registration covers both; a wrapper is not needed just to get custom factories.

Test classes implement `ajax_action(): string` and call `$this->request( $params )`.

**Note:** Ajax base does **not** extend `TestCase` — no `method_call()` / `property_get()` unless composed manually.

## Auth helpers

### login( $role_slug )

Pass a **WordPress role slug** (`subscriber`, `administrator`, `editor`, …).

| Base class | Default role |
|------------|--------------|
| `TestCase` | `subscriber` |
| `BaseAjaxTestCase` | `administrator` |

```php
$user_id = $this->login( 'editor' );          // good
// $this->login( 'manage_options' );           // bad — that is a capability, not a role
```

Custom capability: register on a role before `login()`, then `$this->flush_capabilities()`.

### switch_user( $user_id )

Requires **user-switching** plugin in `tests/plugins-list.php`. Skips test if plugin inactive.

## Reflection helpers (TestCase only)

| Method | Purpose |
|--------|---------|
| `method_call( $object, $method, $args, $get_echo )` | Invoke private/protected/static method |
| `property_set( $object, $property, $value )` | Set private/protected property |
| `property_get( $object, $property, &$value )` | Read private/protected property |

### Capturing echoed output

`method_call( $object, $method, $arguments, true )` — fourth argument `true` returns buffered output instead of the return value:

```php
$output = $this->method_call( $handler, 'renderNotice', [], true );
$this->assertStringContainsString( 'Success', $output, 'Notice was not rendered' );
```

## Assertion message helpers

```php
$this->assertTrue(
	$ok,
	$this->method_working_notice( MyClass::class, 'save', 42 )
);

$this->assertFileExists(
	$path,
	$this->template_working_notice( 'panel.php', 'Admin' )
);
```

## URIs

```php
$this->go_to( get_permalink( $post_id ) );
```

Sets permalink structure to `/%postname%/` then simulates the main query.

## Other helpers

Available on `TestCase` (and its children) unless noted:

| Helper | Returns / does |
|--------|----------------|
| `lorem_ipsum()` | Fixed filler text for content assertions |
| `sample_post_thumbnail( $post_id )` | Uploads WordPress's `DIR_TESTDATA/images/canola.jpg` fixture and sets it as the featured image; returns attachment id |
| `get_current_language()` | Current WPML language, or the locale prefix when WPML is absent |
| `set_current_language( $code )` | Switches WPML language; returns `false` when WPML is absent |
| `can_switch_user()` | Whether the user-switching plugin is active |
| `flush_capabilities()` | Recomputes caps for the current user after a role/cap change |
| `table_columns( $table )` | `DBTestCase` only — column names for a raw table |

## MultiLangTestCase

Extend for WPML behavior without the real plugin. Requires `WPML_ENABLED=1` in `phpunit.xml.dist`.

| Method | Purpose |
|--------|---------|
| `translate_post( $base_id, $translated_id, $language )` | Registers a translation pair used by the `wpml_object_id` filter |
| `current_lang()` | Reads the current language code |
| `current_lang( $code )` | Switches to `$code` and returns it |
| `wpml_object_id( … )` | Filter callback resolving ids through the registered pairs |

```php
$this->translate_post( $en_id, $fa_id, 'fa' );
$this->current_lang( 'fa' );

$this->assertSame( $fa_id, apply_filters( 'wpml_object_id', $en_id, 'product', true, 'fa' ), 'WPML id was not translated' );
```
