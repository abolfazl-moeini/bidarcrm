# Mocking

Use **PHPUnit mocks** and **`WPDevTest\Proxy\ObjectProxy`**. Do **not** use `createTestProxy` (external / not in `plugin-core-test`).

## PHPUnit createMock (interaction tests)

Assert a dependency method is called with expected arguments:

```php
$widget = $this->createMock( SampleWidget::class );

$widget
    ->expects( $this->once() )
    ->method( 'add_control' )
    ->with(
        $this->equalTo( 'control_id' ),
        $this->equalTo( [ 'type' => 'select', 'label' => 'Choose' ] )
    );

$transformer->apply( $widget, $panel );
```

Package sample for hook helpers: `packages/plugin-core-test/tests/unit/TestCases/TestBaseTestCase.php`.

## getMockBuilder for hook callbacks

```php
$mock = $this->getMockBuilder( \stdClass::class )
    ->setMethods( [ 'hook' ] )
    ->getMock();

$mock->expects( $this->once() )
    ->method( 'hook' )
    ->with( $this->equalTo( false ), $this->equalTo( 123 ), $this->equalTo( $options ) )
    ->willReturn( [] );

add_filter( 'my_plugin/get_by/sample', [ $mock, 'hook' ], 9, 3 );

// Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
\Vendor\Plugin\Model::get_by( 'sample', 123, $options );
```

## Simple filter stub

```php
add_filter( 'my_plugin/get_by/my', '__return_empty_array' );

// Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
$this->assertEquals( [], \Vendor\Plugin\Model::get_by( 'my', 123 ) );
```

## Hook registration assertions

From `WPDevTest\TestCases\BaseTestCase`:

**Order matters:** register the action/filter **first**, then call `expectAddAction` / `expectFilter`. The helper inspects `$wp_filter` after registration. Calling expect *before* register always throws.

```php
MySetup::register(); // or add_action( ... ) that production code uses
$this->expectAddAction( 'my_plugin_init', [ MySetup::class, 'init' ], 10 );
```

**Semantics:** `expectAddAction()` **throws** an exception when the hook, callback, or priority does not match — it is not a PHPUnit assertion. It also calls `expectNotToPerformAssertions()`, which suppresses the "risky test" warning for the whole test method. Keep hook-registration checks in their own test so that suppression cannot hide a missing assertion elsewhere.

For **`expectFilter()`** — pass the filter name and the exact arguments the callback receives; use the returned mock for `willReturn()`. See [test-authoring-examples.md](test-authoring-examples.md).

## ObjectProxy

`WPDevTest\Proxy\ObjectProxy` wraps a real object. Overrides live in stacks; unmatched calls/properties fall through to the wrapped instance.

### When to use

| Tool | Use when |
|------|----------|
| `ObjectProxy` | Substitute behavior in production code paths (fake method return, inject dependency) |
| `method_call()` / `property_get()` | One-off access to private/protected API on the real class |
| `createMock()` | Strict interaction / call-count assertions |

### API

```php
use WPDevTest\Proxy\ObjectProxy;

$real  = new MyService( $dependency );
$proxy = new ObjectProxy( $real );

// Fixed method return (not callable — stored value):
$proxy->method_set( 'fetchRemote', [ 'id' => 1, 'name' => 'stub' ] );
$data = $proxy->fetchRemote();  // returns stub array; real method not called

// Property override:
$proxy->property_set( 'apiKey', 'test-key' );
// or: $proxy->apiKey = 'test-key';

// Pass proxy where production expects MyService:
$handler = new Handler( $proxy );
```

| Method | Behavior |
|--------|----------|
| `method_set( $method, $value )` | Return `$value` on `$method()` (uses `isset` — **cannot** override with `null`) |
| `method_get( $method )` | Read stacked override |
| `property_set( $property, $value )` | Override `__get` |
| `property_get( $property )` | Read property stack |
| `__call` | Stack override, else delegate to `$instance` |
| `__get` / `__set` | Stack override, else delegate |

### Limitations

- `method_set` with `null` does not work (stack uses `isset`).
- `__isset` only checks the property stack, not the real object.

Tests: `packages/plugin-core-test/tests/unit/Proxy/TestObjectProxy.php`.

**Warning:** that sample also calls `createTestProxy()` in one case. It is a package-internal test against an external helper — do not copy it into plugin tests.

## External HTTP

See [patterns-rest-ajax-http.md](patterns-rest-ajax-http.md) — `pre_http_request` with **`remove_filter` in `tearDown()`**.

## tearDown cleanup checklist

Non-DB side effects to undo:

- [ ] `remove_filter` / `remove_action` for hooks added in test
- [ ] `wp_deregister_script` / `wp_dequeue_script` for registered handles
- [ ] `delete_transient` for transients created in test
- [ ] Reset globals or statics if mutated

Database changes roll back automatically between tests.
