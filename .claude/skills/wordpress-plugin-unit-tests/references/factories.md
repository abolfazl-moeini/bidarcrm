# Factories

## WordPress core factory

Access via `$this->factory()` on `TestCase` and `BaseAjaxTestCase`:

```php
$user_id = $this->factory()->user->create( [
    'user_login' => 'wpdev',
    'role'       => 'subscriber',
] );

$post_id = $this->factory()->post->create( [
    'post_title'  => 'Test post',
    'post_status' => 'publish',
] );

$term_id = $this->factory()->term->create( [
    'name'     => 'Category',
    'taxonomy' => 'category',
] );
```

Core factories available on `$this->factory()` include: `user`, `post`, `comment`, `term`, `attachment`, `blog` (multisite). Use WordPress core docs for property lists — this skill does not bundle a separate factory API doc.

## Custom domain factories

`WPDevTest\Factory` fires **`do_action( 'WPDevTest/Factory', $this )`** in its constructor. `TestCase` and `BaseAjaxTestCase` each keep a **process-lifetime static** factory, so the action can fire up to twice per process (once per base branch) — never once-per-test.

### Register in bootstrap.php (required)

`factory()` is a **process-lifetime static**: it is built the first time any test class asks for it, and every later class reuses that instance. Because the suite runs in **random order**, you cannot know which class is first. If you register the hook in one base class's `setUp()` and a different class (bootstrap test, Ajax test, package `TestCase`) happens to run first, the factory is already built and your callback never fires — `$this->factory()->{thing}` is then undefined, at random.

Register **process-wide in `tests/unit-tests/bootstrap.php`**, inside the `Setup::setup()` callback:

```php
<?php

declare( strict_types=1 );

require dirname( __DIR__, 2 ) . '/vendor/autoload.php';

WPDevTest\Setup::setup( static function () {

    add_action( 'WPDevTest/Factory', static function ( $factory ) {
        // Replace VendorTest\Plugin with your test namespace ({Vendor}Test\{Plugin}).
        $factory->item = new \VendorTest\Plugin\Factory\ItemFactory( $factory );
    } );
} );
```

This runs before any test class loads, so registration is order-independent.

**Optional belt-and-braces:** a base class may also register the same callback before `parent::setUp()`. It is harmless when the factory already exists, but it is **not** a substitute for the bootstrap registration.

### Factory class

Extend `WP_UnitTest_Factory_For_Thing`:

The WordPress factory contract requires all three methods below. The `ItemModel`
calls are illustrative: open the plugin's real model/repository API and replace
them before using the factory. The explicit exceptions prevent a copied
placeholder from silently returning `null`.

```php
class ItemFactory extends \WP_UnitTest_Factory_For_Thing {
    public function __construct( $factory = null ) {
        parent::__construct( $factory );
        $this->default_generation_definitions = [
            'owner_id' => 0,
            'state_id' => 'active',
        ];
    }

    public function create_object( $args ) {
        // Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
        $model = new \Vendor\Plugin\Model\ItemModel();
        return $model->insert( wp_parse_args( $args, $this->default_generation_definitions ) );
    }

    public function update_object( $item_id, $fields ) {
        throw new \LogicException( 'Implement update_object() with the plugin model API.' );
    }

    public function get_object_by_id( $item_id ) {
        throw new \LogicException( 'Implement get_object_by_id() with the plugin model API.' );
    }
}
```

### Usage in tests

```php
$item_id = $this->factory()->item->create( [
    'owner_id' => $user_id,
    'state_id' => 'active',
] );
```

## Ajax tests and factories

Ajax tests extend `WPDevTest\TestCases\BaseAjaxTestCase`, which has its **own** static factory (`BaseAjaxTestCase.php`) separate from `TestCase`. Bootstrap registration covers both, because the hook fires whenever a `WPDevTest\Factory` is constructed. This is another reason not to register from a single base class's `setUp()`.

Reference: `packages/plugin-core-test/src/TestCases/BaseAjaxTestCase.php`.
