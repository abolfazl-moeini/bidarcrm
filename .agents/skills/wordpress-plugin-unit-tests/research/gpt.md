I researched this against current WooCommerce trunk, current developer advisories, public Automattic/Woo extension repositories, and the relevant Composer ecosystem as of **September 12, 2026**. The biggest architectural distinction is that WooCommerce’s own “unit” suite is largely **database-backed WordPress integration testing** in strict testing terminology; a modern `wc-core-test` should deliberately separate that layer from true no-WordPress/no-MySQL unit tests.

# Modernizing WooCommerce Unit & Integration Testing Architecture — `wc-core-test` v2.0

## 1. Executive Summary & Ecosystem Reality Check

`wpdev/wc-core-test` should not be modernized by merely replacing old static helpers with prettier static helpers. The fundamental change should be architectural:

> **Pure application logic should be testable without WordPress, WooCommerce, or MySQL. WooCommerce behavior and persistence should be tested against the real platform. Fixture creation should use the cheapest production-faithful path necessary for each assertion.**

That conclusion follows directly from the direction of WooCommerce core itself.

Current WooCommerce test guidance now explicitly describes a **fixture ladder**: use a complete `WC_Helper_Order::create_order()`/`OrderHelper::create_order()` only when full commerce behavior is actually part of the contract; use minimal `wc_create_order()` when only a real order record is required; and directly seed database rows when the production code under test is purely a reader of a persistence boundary. WooCommerce notes that a full helper-created order can involve roughly **29 database writes plus hook cascades**. ([GitHub][1])

WooCommerce has also become much stricter about transactional isolation. Current guidance explicitly says tests run inside the `WP_UnitTestCase` transaction and warns that `TRUNCATE TABLE` performs an implicit MySQL commit, destroying rollback isolation. The prescribed replacement is `DELETE FROM`; class-level immutable fixtures and boundary-specific seeding are encouraged when they materially reduce suite cost. ([GitHub][1])

HPOS makes the old model of treating orders as WordPress posts untenable. WooCommerce's current HPOS guidance explicitly tells extensions to audit order-related usage of `get_post_meta`, `update_post_meta`, `wp_update_post`, direct `$wpdb`, `shop_order` post queries, and similar APIs, and to replace them with WooCommerce CRUD. ([The WooCommerce Developer Blog][2]) This became even more important in WooCommerce 10.7: HPOS “sync on read” was disabled by default, so code that modifies the legacy posts/postmeta representation and expects HPOS to discover those writes later can simply be wrong. ([The WooCommerce Developer Blog][3])

The ecosystem does **not** have a universally adopted standalone WooCommerce test framework. WooCommerce still keeps its factories and HPOS test machinery inside the main repository. There is no current official `woocommerce/test-framework` package. Third-party projects therefore either:

* bootstrap WooCommerce itself and maintain their own test layer;
* depend on WordPress/wp-browser infrastructure;
* copy or adapt small portions of Woo testing infrastructure;
* use QIT for outer compatibility/E2E coverage;
* or isolate business logic sufficiently that the majority of tests do not need WooCommerce at all.

The old Automattic extension-testing guide demonstrates the historical approach of explicitly loading WooCommerce's internal helper files from a Woo checkout. That worked, but it couples the extension directly to Woo's internal test tree and is not a suitable v2 dependency contract. ([GitHub][4])

### Recommended target architecture

`wc-core-test` v2 should contain four clearly separated concepts:

| Layer             | Responsibility                                          | WordPress/Woo/MySQL? |
| ----------------- | ------------------------------------------------------- | -------------------- |
| Pure Unit         | Plugin-owned domain/services/policies                   | No                   |
| Integration       | Real Woo CRUD, hooks, persistence, sessions, Store API  | Yes                  |
| Fixture API       | Deterministic CRUD builders + explicit boundary seeders | Integration only     |
| Compatibility/E2E | Classic/Blocks/Store API/version compatibility          | QIT/Playwright/CI    |

The key rules should be:

1. **Builders never silently change HPOS mode.**
2. **CRUD builders are storage-neutral.**
3. **Direct SQL lives in explicit `Seeder` classes, never generic factories.**
4. **Per-test database cleanup should mostly be rollback, not deletion.**
5. **Global Woo state must be reset independently of database rollback.**
6. **Old static APIs remain only as deprecated compatibility façades.**
7. **True unit tests should mock plugin-owned abstractions before mocking dozens of Woo globals.**
8. **HPOS and CPT should be separate CI/environment dimensions.**
9. **Compatibility mode should not be the default HPOS test configuration because it can hide storage mistakes.**
10. **PHP 7.4 syntax can be retained in v2, but the support policy must acknowledge WooCommerce's likely move to PHP 8.1+.**

---

# 2. Pillar 1 — WooCommerce Core Testing Internals & Fixture Ladders

## 2.1 What WooCommerce calls a “unit test”

This is an important terminology mismatch.

WooCommerce's PHP test suite boots WordPress, loads WooCommerce, connects to MySQL, manipulates the WordPress test transaction, registers post types/taxonomies, and exercises actual data stores. The Woo README calls these “unit tests,” but from a conventional software-testing perspective most of them are **integration tests**. Woo requires an actual test database or its `wp-env` environment to run them. ([GitHub][1])

For `wc-core-test`, I recommend using stricter terminology:

* `tests/Unit/` = no WordPress bootstrap, no database.
* `tests/Integration/` = WordPress + WooCommerce + test DB.
* `tests/Contract/` = optional Store API/REST/server-side contracts.
* `tests/E2E/` = browser/Blocks/classic checkout.

That naming alone will stop a considerable amount of architectural confusion.

---

## 2.2 `HposTestCase`

Current WooCommerce trunk contains `HposTestCase`, which extends the Woo test base and provides HPOS-oriented assertions and synchronization utilities. It is used for suites concerned specifically with order storage behavior. ([GitHub][5])

Conceptually it provides facilities such as:

* verifying whether an order exists in the HPOS custom tables;
* verifying CPT/post-backed records;
* asserting deleted records;
* triggering or validating order synchronization;
* interacting with the two order representations in storage-focused tests.

A crucial architectural point:

> `HposTestCase` is **not** a generic public test base that third-party plugins should extend.

It lives under WooCommerce's own test tree and is designed to test WooCommerce's HPOS implementation itself.

For third-party extensions, the equivalent requirement is generally much simpler:

> “Run the same extension integration behavior with HPOS authoritative, then with CPT authoritative.”

Your library therefore should borrow the **concept**, not inherit Woo's internal test class.

---

## 2.3 `HPOSToggleTrait`

`HPOSToggleTrait` provides Woo core tests with routines to enable, disable, prepare, and synchronize HPOS/COT modes. Current trunk shows an important modernization in its table preparation path: `setup_cot_tables()` ensures that permanent HPOS tables exist and then clears the four order tables with `DELETE FROM`, explicitly without resetting IDs. ([GitHub][6])

Current code effectively does:

```php
foreach ( $tables as $table ) {
    $wpdb->query( "DELETE FROM {$table}" );
}
```

rather than `TRUNCATE`.

The trait also contains older machinery for disabling WordPress's temporary-table query filters and recreating the order custom tables. That distinction matters: Woo core still has compatibility machinery for specialized HPOS tests, but its newer isolation guidance clearly favors **permanent schema + transactional data changes** rather than casual DDL inside test lifecycle methods. ([GitHub][6])

### Implication for `wc-core-test`

Do **not** expose:

```php
OrderBuilder::make()
    ->withHposEnabled()
    ->create();
```

That would combine a fixture concern with a global test-environment concern.

Instead:

```text
CI/bootstrap
    ↓
OrderStorageManager
    ↓
activate HPOS or CPT once for suite/process
    ↓
storage-neutral OrderBuilder
```

HPOS is global process/store state. It should therefore be controlled at the process, suite, or class boundary.

---

# 3. WooCommerce's Modern “Fixture Ladder”

Current WooCommerce guidance formalizes a particularly useful principle: use the **cheapest fixture that still exercises the production branch under test**. ([GitHub][1])

For orders, the ladder is approximately:

| Rung | Mechanism                             |               Fidelity |      Cost | Use when                                                    |
| ---- | ------------------------------------- | ---------------------: | --------: | ----------------------------------------------------------- |
| 1    | Full `OrderHelper::create_order()`    |                Highest | Very high | totals, items, shipping, addresses and hook behavior matter |
| 2    | `wc_create_order()` + minimal setters | Production persistence |       Low | existence, status, permissions, simple metadata matter      |
| 3    | Direct boundary rows                  |         Read-path only |    Lowest | aggregate SQL, migrations, lookup readers                   |

Woo's README specifically notes that a complete helper order can cost around **29 writes plus hook cascades**, while a minimal `wc_create_order()` can reduce that to essentially the order write needed for the test. ([GitHub][1])

### This principle should become the center of v2

Old:

```php
$order = Order::create_order();
```

The helper decides everything:

* customer;
* products;
* addresses;
* shipping;
* totals;
* taxes;
* metadata;
* status.

Modern:

```php
$order = OrderBuilder::make()
    ->withCustomerId( $customer_id )
    ->withStatus( 'processing' )
    ->create();
```

Only those properties exist.

A test requiring real line-item behavior deliberately climbs the ladder:

```php
$order = OrderBuilder::make()
    ->withProduct( $product, 2 )
    ->withShippingAddress( $address )
    ->calculateTotals()
    ->create();
```

And a SQL aggregation test goes *down* the ladder:

```php
OrderRowSeeder::make()
    ->status( 'wc-completed' )
    ->total( '42.00' )
    ->insert();
```

The seeder must be visibly separate because direct table insertion deliberately bypasses production write behavior.

---

# 4. Core Traits and Lifecycle Ideas Worth Adopting

## `MetaDataAssertionTrait`

The current Woo trait is more specialized than its name suggests: it supports metadata-related assertions used by Woo's REST API tests rather than being a universal metadata testing framework. ([GitHub][7])

Recommendation:

**Do not import it.**

Instead copy the principle of domain-specific assertion traits:

```text
Assertions/
    OrderAssertions.php
    ProductAssertions.php
    MetaDataAssertions.php
```

Keep assertions semantic:

```php
$this->assertOrderMetaSame( 'foo', 'bar', $order );
```

rather than leaking HPOS/CPT representation into tests.

---

## `LoggerSpyTrait`

Woo contains a logger-spy trait that installs a test logger and captures messages across Woo log levels. ([GitHub][8])

This is an excellent pattern for v2 because logging is otherwise frequently tested through brittle global replacements.

Recommended public API:

```php
$this->loggerSpy()->expectNotice( 'Payment ignored' );
$this->loggerSpy()->expectErrorContaining( 'Remote API' );
```

The v2 implementation should own its logger spy rather than requiring Woo's test-internal trait.

---

## `SerializingCacheTrait`

Woo's `SerializingCacheTrait` replaces the runtime cache with a proxy that serializes values, making tests behave more like environments with a persistent object cache rather than PHP-object identity remaining magically available. ([GitHub][9])

This catches an important category of bugs:

```php
$object = wp_cache_get(...);

// Code accidentally relies on it being the exact same PHP instance.
```

With Redis/Memcached-style behavior, the value goes through serialization/deserialization.

Recommended v2 equivalent:

```php
trait UsesSerializingObjectCache
{
    // Replace cache during test.
    // Restore exact previous cache in finally/teardown.
}
```

Make it opt-in rather than paying the cost for every integration test.

---

# 5. Lifecycle Isolation in Current Woo Core

WooCommerce's current base test case contains another important modernization.

Its teardown explicitly performs Woo singleton cleanup inside a `try`, then **always calls parent teardown in `finally`**, because the parent is responsible for rolling back the database transaction and restoring hooks. ([GitHub][10])

Conceptually:

```php
public function tearDown(): void
{
    try {
        $this->clearWooState();
    } finally {
        parent::tearDown();
    }
}
```

That should be a hard invariant in v2.

Woo's current cleanup recognizes that database rollback is insufficient because some state lives entirely in memory. Its test case now clears:

* cart contents;
* cart context;
* queued notices;
* cached country locale.

It specifically resets `cart_context` from `store-api` back to `shortcode`, because Store API requests can leave that global singleton state behind. ([GitHub][10])

Woo also substitutes a mock session handler during tests because normal cookie-backed session behavior does not exist in the PHPUnit environment. ([GitHub][10])

This is directly relevant to the common:

```text
Call to a member function get() on null
```

class of failures.

---

# 6. Dangerous Legacy Practices

## 6.1 `TRUNCATE TABLE`

This should be forbidden by v2.

MySQL treats `TRUNCATE` as DDL and it commits the transaction. Consequently:

```text
START TRANSACTION
test creates object A
TRUNCATE some_table   ← implicit commit
test creates object B
ROLLBACK
```

does **not** return the database to its initial state.

Woo's current test documentation explicitly tells contributors never to use it and to use `DELETE FROM` instead. ([GitHub][1])

Better still, inside ordinary per-test lifecycle:

> Usually perform neither `DELETE` nor `TRUNCATE`; allow `WP_UnitTestCase` rollback to own cleanup.

---

## 6.2 Direct `update_post_meta()` on orders

This is now a critical HPOS bug, not merely a style smell.

WooCommerce's HPOS documentation specifically directs extensions away from WordPress post/meta APIs for order manipulation. ([The WooCommerce Developer Blog][2])

Use:

```php
$order->update_meta_data( '_my_key', $value );
$order->save();
```

not:

```php
update_post_meta( $order_id, '_my_key', $value );
```

Starting with WooCommerce 10.7, HPOS sync-on-read being disabled by default further removes the safety net that previously could mask these bugs. ([The WooCommerce Developer Blog][3])

---

## 6.3 Coupons and products

Coupons and products are not the same HPOS problem as orders today, but direct WordPress metadata manipulation is still poor fixture design.

Prefer:

```php
$coupon = new WC_Coupon();
$coupon->set_code( 'TEST20' );
$coupon->set_amount( '20' );
$coupon->save();
```

over writing coupon post meta directly.

The reason is abstraction correctness:

* data-store APIs;
* cache invalidation;
* hooks;
* validation;
* future storage changes.

---

## 6.4 Reusing mutable object instances across tests

Class-level fixtures are good only when the persisted data is immutable.

Do:

```php
private static $product_id;

public function testSomething(): void
{
    $product = wc_get_product( self::$product_id );
}
```

Do not store a mutable `WC_Product` PHP instance and pass that same instance through twenty tests.

Woo's current test guidance similarly recommends sharing immutable fixtures but **reloading fresh objects per test**. ([GitHub][1])

---

# 7. Pillar 2 — Community & Commercial Extension Testing Patterns

There is no single consistent “commercial Woo testing architecture.” Public evidence shows several patterns.

## Automattic / WooPayments

WooPayments publicly describes PHP unit, JavaScript unit, E2E, and QIT suites. ([GitHub][11])

Its current development dependencies include:

* PHPUnit 9.6.34;
* PHPUnit Polyfills;
* PHPStan;
* Woo/WordPress stubs;
* QIT CLI.

([GitHub][12])

Its review rules also show the value of an extension-specific base test case: tests are expected to extend `WCPAY_UnitTestCase` and use centralized Woo/payment helpers rather than hand-constructing setup repeatedly. ([GitHub][13])

That supports creating a stable `wc-core-test` integration base rather than asking every plugin to invent lifecycle logic.

---

## WooCommerce Stripe

The official Stripe extension uses:

* PHPUnit;
* Docker-backed PHP tests;
* ParaTest for parallel execution;
* Jest;
* Playwright;
* PHPStan.

([GitHub][14])

For checkout/payment-method changes its repository explicitly calls for verification of both classic and modern Blocks checkout paths. ([GitHub][15])

Its current Composer configuration still pins a PHP 7.4 platform and PHPUnit 9.6.34, alongside PHPUnit Polyfills and ParaTest. ([GitHub][16])

This supports the proposed v2 toolchain target.

---

## WooCommerce PayPal Payments

PayPal Payments publicly exposes distinct commands for:

```text
unit-tests
integration-tests
test:unit-js
full test suite
coverage
```

and emphasizes retaining PHP 7.4-compatible syntax. ([GitHub][17])

This explicit unit/integration distinction is closer to the architecture I recommend than Woo core's historical naming.

---

## YITH

The public YITH flagship repositories do not expose enough of the proprietary/commercial testing stack to responsibly infer their internal test architecture.

Therefore the correct research conclusion is:

> YITH cannot be used as strong public evidence for a particular Woo test-helper architecture.

Absence of public tests should not be interpreted as absence of private CI/testing.

---

## Barn2

Public Barn2 repositories demonstrate PHPUnit, Playwright, and static-analysis infrastructure, but the publicly inspectable projects are not sufficient to establish a unique WooCommerce fixture strategy across Barn2's proprietary extension portfolio.

The relevant takeaway is the same layered QA pattern rather than a reusable Woo fixture library.

---

## WPDesk

Public WPDesk repositories expose explicit integration-test layouts/configuration in some shared libraries. Again, the strong finding is separation of test layers rather than evidence of a universal Woo fixture package.

---

## Level Level

Level Level provides the most directly relevant public reusable package found:

`level-level/wp-browser-woocommerce`.

It explicitly provides **WooCommerce object factories for wp-browser integration tests**, including a `WCTestCase` and an AJAX-oriented test case. The package is still publicly maintained and had roughly 16.5k Packagist installs at the time of research. ([Packagist][18])

It validates the usefulness of reusable Woo factories.

However, it is coupled to:

```text
lucatume/wp-browser
```

and should not become a foundational dependency if `wc-core-test` intends to support conventional WordPress PHPUnit environments independently.

---

# 8. Composer Package Evaluation

| Package                                | What it actually provides                                             | Recommended role                            |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| `level-level/wp-browser-woocommerce`   | Woo object factories for wp-browser integration tests                 | Good if wp-browser is already your standard |
| `woocommerce/qit-cli`                  | Compatibility, Woo API/E2E, activation/security/PHPStan orchestration | Outer compatibility layer                   |
| `humanmade/woocommerce-demo-generator` | Faker/WP-CLI demo products/orders                                     | Demo/load data, not deterministic fixtures  |
| `woocommerce/wc-smooth-generator`      | Large realistic product/order/customer/coupon generation              | Performance/demo/scale testing              |
| Brain Monkey                           | Function/WordPress API mocking                                        | Pure-unit layer                             |
| Mockery                                | Object doubles/expectations                                           | Pure-unit layer                             |

### QIT

QIT is active: version 1.3.1 was published in July 2026 and updated in September. Its scope includes Woo E2E/API tests, activation, security, PHPStan, and configurable Woo/WordPress/PHP environments. ([Packagist][19])

It should **not** replace your local unit/integration framework.

Use it for the outer ring:

```text
fast units → local integration → compatibility matrix → QIT/E2E
```

---

## Human Made demo generator

`humanmade/woocommerce-demo-generator` is a recent WP-CLI/Faker package intended to generate realistic Woo demo products/orders. It requires PHP 8.0+ and is oriented toward volume/demo datasets. ([Packagist][20])

It is not appropriate for deterministic per-test fixtures.

---

## Woo Smooth Generator

Woo's own `wc-smooth-generator` is much more mature and can generate products, orders, customers, coupons, and other realistic data programmatically or through WP-CLI. ([Packagist][21])

Its correct use cases are:

* performance suites;
* high-volume pagination tests;
* development/demo stores;
* long-running compatibility tests.

It should not be the core factory implementation for unit/integration tests because random/realistic generation works against deterministic minimal fixtures.

---

# 9. Why There Is Still No `woocommerce/test-framework`

I found no official published WooCommerce rationale saying, “We deliberately refuse to publish a test-framework package.”

So the following is an architectural inference, not an official policy statement.

Woo's test helpers are deeply coupled to:

* WordPress's PHPUnit lifecycle;
* Woo's test bootstrap;
* Woo's internal DI container;
* internal data-store implementations;
* global singletons;
* current Woo trunk;
* test-only namespaces;
* HPOS implementation internals.

The current `HPOSToggleTrait`, for example, imports classes from Woo's `Internal\DataStores\Orders` namespace and itself lives in a test namespace. ([GitHub][6])

Turning those files into a supported Composer package would imply a semver compatibility contract Woo currently does not maintain for them.

Historically, Automattic's extension test guide simply told extension developers to load selected helper files from WooCommerce's test checkout. ([GitHub][4])

### Clean modern workaround

`wc-core-test` should therefore function as the missing **stable façade**, but only around public behavior.

Its dependency direction should be:

```text
Plugin tests
     ↓
wc-core-test stable API
     ↓
Woo public CRUD/API
     ↓
version-specific adapter
     ↓
unavoidable Woo internals
```

Never:

```text
Plugin tests
     ↓
direct dependency on Woo /tests/php/helpers/*
```

Internal Woo interactions necessary for toggling HPOS should be isolated in compatibility adapters so a Woo core refactor changes one file rather than hundreds of plugin tests.

---

# 10. Pillar 3 — Fast Unit Testing vs Heavy Integration Testing

## 10.1 Brain Monkey and Mockery remain viable

Brain Monkey 2.7.0 was released in February 2026 and remains an actively maintained utility for mocking PHP functions and the WordPress plugin API. It uses Mockery underneath. ([Packagist][22])

Mockery 1.6.15 was released in August 2026 and supports PHP >=7.3. ([Packagist][23])

Yoast's `wp-test-utils` also provides a useful modern reference architecture: a Brain Monkey test case which manages Brain Monkey/Mockery lifecycle plus a separate WordPress integration test case extending `WP_UnitTestCase`. ([GitHub][24])

This is essentially the hybrid architecture `wc-core-test` should adopt.

---

# 11. Preferred Pure-Unit Architecture: Mock Your Ports

The fastest and most maintainable test is not:

```php
Functions\expect( 'wc_get_order' );
Functions\expect( 'wc_price' );
Functions\expect( 'get_option' );
Functions\expect( 'apply_filters' );
Functions\expect( 'current_user_can' );
```

everywhere.

That merely reconstructs WooCommerce with mocks.

Prefer a plugin-owned boundary:

```php
interface OrderRepository
{
    /**
     * @return OrderView|null
     */
    public function find( int $order_id );
}

interface MoneyFormatter
{
    public function format( float $amount ): string;
}
```

Production adapter:

```php
final class WooOrderRepository implements OrderRepository
{
    public function find( int $order_id )
    {
        $order = wc_get_order( $order_id );

        if ( ! $order ) {
            return null;
        }

        return new OrderView(
            $order->get_id(),
            (float) $order->get_total(),
            $order->get_status()
        );
    }
}
```

Business service:

```php
final class OrderLabelService
{
    private $orders;
    private $money;

    public function __construct(
        OrderRepository $orders,
        MoneyFormatter $money
    ) {
        $this->orders = $orders;
        $this->money  = $money;
    }

    public function label( int $order_id ): string
    {
        $order = $this->orders->find( $order_id );

        if ( null === $order ) {
            return 'Missing order';
        }

        return $this->money->format( $order->total() );
    }
}
```

The unit test now needs Mockery only:

```php
$order_repository = Mockery::mock( OrderRepository::class );
$money             = Mockery::mock( MoneyFormatter::class );

$order_repository
    ->shouldReceive( 'find' )
    ->once()
    ->with( 123 )
    ->andReturn( new OrderView( 123, 42.50, 'processing' ) );

$money
    ->shouldReceive( 'format' )
    ->once()
    ->with( 42.50 )
    ->andReturn( '$42.50' );
```

That suite can run without loading WooCommerce at all.

---

# 12. Where Brain Monkey Fits

Brain Monkey is still valuable at unavoidable WordPress/Woo function seams.

For example:

```php
use Brain\Monkey\Functions;

Functions\expect( 'wc_price' )
    ->once()
    ->with( 42.50 )
    ->andReturn( '$42.50' );

$this->assertSame(
    '$42.50',
    $formatter->format( 42.50 )
);
```

Or:

```php
Functions\expect( 'wc_get_order' )
    ->once()
    ->with( 123 )
    ->andReturn( $order );
```

But the architectural goal should be:

> Brain Monkey at adapter boundaries, not throughout the domain layer.

The more Woo functions a pure unit test mocks, the less useful that test becomes for detecting integration breakage.

---

# 13. The Unit / Integration Dividing Line

A useful decision rule is:

> **If the assertion is about what your code decides, unit test it. If the assertion is about what WooCommerce/WordPress stores, calculates, resolves, synchronizes, fires, or exposes, integration test it.**

### Pure unit

Good candidates:

* pricing policies you own;
* eligibility logic;
* mapper/DTO transformations;
* validation;
* payload creation;
* retry policies;
* routing/decision trees;
* feature-flag logic;
* string/value normalization;
* domain calculations that do not intentionally delegate to Woo;
* orchestrators against plugin-owned interfaces.

### Integration

Use real Woo/WordPress for:

* `WC_Order` persistence;
* order metadata;
* HPOS vs CPT compatibility;
* product CRUD;
* tax calculation;
* Woo totals;
* coupon application;
* refunds;
* stock changes;
* customer CRUD;
* Action Scheduler;
* roles/capabilities;
* transients/object caches;
* Woo hooks whose timing matters;
* Store API controllers;
* REST routes;
* carts;
* sessions;
* notices;
* shipping methods/rates/zones.

### E2E

Use browser testing for:

* Cart/Checkout Blocks UI;
* JavaScript extension slots;
* block payment methods;
* classic vs Blocks checkout;
* checkout redirects;
* browser wallet flows;
* DOM-facing validation.

The official Stripe repository's insistence on testing classic and Blocks paths for checkout-related changes is good evidence for maintaining this third layer. ([GitHub][15])

---

# 14. Sessions, Carts and Notices

The safest approach is to stop initializing these globally in every test.

A normal integration test that only manipulates orders does not need:

```text
WC()->session
WC()->customer
WC()->cart
```

Initialize them lazily only for cart/session tests.

Recommended v2 API:

```php
$this->wooState()->bootSession();
$this->wooState()->bootCustomer( $user_id );
$this->wooState()->bootCart();
```

The package implementation should provide a cookie-free/in-memory session implementation analogous to Woo's own mock-session approach. Woo's current test base installs `WC_Mock_Session_Handler` specifically because real cookies are not available in test execution. ([GitHub][10])

### Teardown must reset more than the DB

Current Woo core explicitly says cart, cart context, notices and locale cache survive database rollback/hook restoration and must be reset manually. ([GitHub][10])

Your state cleaner should perform approximately:

```php
if ( isset( WC()->cart ) ) {
    if ( isset( WC()->session ) ) {
        WC()->cart->empty_cart( false );
    }

    WC()->cart->cart_context = 'shortcode';
}

if ( isset( WC()->session ) ) {
    wc_clear_notices();
}

if ( isset( WC()->countries ) ) {
    WC()->countries->locale = array();
}
```

The `isset( WC()->session )` guard before notices matters. Calling notice/session APIs on a null session is precisely how many isolated tests fail. ([GitHub][10])

For pure unit tests, do not boot a real cart merely to satisfy code under test. Put cart access behind your own interface and mock it.

---

# 15. Pillar 4 — Recommended `wc-core-test` v2 Architecture

## 15.1 Proposed package structure

```text
src/
├── Integration/
│   ├── TestCase.php
│   │
│   ├── Fixture/
│   │   ├── ProductBuilder.php
│   │   ├── OrderBuilder.php
│   │   ├── CouponBuilder.php
│   │   ├── CustomerBuilder.php
│   │   └── RefundBuilder.php
│   │
│   ├── Seed/
│   │   ├── OrderRowSeeder.php
│   │   ├── OrderMetaRowSeeder.php
│   │   └── LookupTableSeeder.php
│   │
│   ├── Storage/
│   │   ├── OrderStorageMode.php
│   │   ├── OrderStorageManager.php
│   │   └── OrderStorageAdapter.php
│   │
│   ├── State/
│   │   ├── WooStateResetter.php
│   │   ├── SessionManager.php
│   │   ├── LoggerSpy.php
│   │   └── ResourceRegistry.php
│   │
│   ├── Assertion/
│   │   ├── OrderAssertions.php
│   │   └── MetaDataAssertions.php
│   │
│   └── Cache/
│       └── UsesSerializingObjectCache.php
│
├── Compatibility/
│   ├── WooVersion.php
│   ├── Woo8Adapter.php
│   ├── Woo9Adapter.php
│   └── CurrentWooAdapter.php
│
└── Legacy/
    ├── Product.php
    └── Order.php
```

### Unit package recommendation

I would **not** force Brain Monkey/Patchwork onto every integration-test consumer.

Best option:

```text
wpdev/wc-core-test
wpdev/wc-core-test-unit
```

where the second package contains:

```text
Brain Monkey
Mockery
Unit TestCase
Woo/WordPress test doubles
```

If maintaining two packages is undesirable, then `wc-core-test` should document Brain Monkey as an optional consumer dependency instead of making its entire integration stack depend on Patchwork.

---

# 16. Builder API

## Product

```php
<?php

declare(strict_types=1);

namespace Wpdev\WcCoreTest\Integration\Fixture;

final class ProductBuilder
{
    public static function simple(): self
    {
        return new self();
    }

    public function named( string $name ): self;

    public function pricedAt( string $price ): self;

    public function withSku( string $sku ): self;

    public function withStock( int $quantity ): self;

    /**
     * @param mixed $value
     */
    public function withMeta( string $key, $value ): self;

    /**
     * Returns an unsaved object.
     */
    public function build(): \WC_Product;

    /**
     * Persists through Woo CRUD.
     */
    public function create(): \WC_Product;
}
```

Important semantic rule:

> Fluent setters must not save.

This is bad:

```php
$builder->price( '10' ); // SAVE
$builder->sku( 'A' );    // SAVE
$builder->stock( 2 );    // SAVE
```

Instead accumulate configuration, apply it to the object, and save once.

---

# 17. OrderBuilder

```php
$order = OrderBuilder::make()
    ->withCustomerId( $customer_id )
    ->withStatus( 'processing' )
    ->withMeta( '_plugin_test', 'yes' )
    ->create();
```

Full-fidelity fixture:

```php
$order = OrderBuilder::make()
    ->withCustomer( $customer )
    ->withProduct( $product, 2 )
    ->withBillingAddress( $billing )
    ->withShippingAddress( $shipping )
    ->calculateTotals()
    ->create();
```

Convenience:

```php
OrderBuilder::make()
    ->withItems( 2 )
    ->create();
```

may exist, but it should be clearly documented as expensive because it necessarily creates additional product/order-item fixtures.

All generated values must be deterministic.

Do not silently generate:

* random customers;
* random prices;
* random addresses;
* random taxes.

unless the caller explicitly requests randomized/realistic fixtures.

---

# 18. `paid()` Is Too Ambiguous

The proposed API:

```php
->paid()
```

looks elegant but conflates two radically different test requirements.

Woo's payment-completion behavior can trigger:

* status transitions;
* stock handling;
* hooks;
* transaction metadata;
* downstream extension behavior.

Therefore expose two concepts.

Cheap fixture state:

```php
$order = OrderBuilder::make()
    ->asPaidState()
    ->create();
```

This makes persisted state appear paid without intentionally exercising the entire payment-complete pipeline.

Behavioral path:

```php
$order = OrderBuilder::make()
    ->create();

$order->payment_complete( 'txn-test-123' );
```

or:

```php
OrderBuilder::make()
    ->paymentCompleted( 'txn-test-123' )
    ->create();
```

if the builder explicitly documents that the full Woo behavior is invoked.

This distinction makes fixture cost and side effects visible.

---

# 19. HPOS & Data Store Compatibility

## Builders must never know the active storage mode

This is the core v2 rule.

This code should work unmodified under both:

```php
$order = OrderBuilder::make()
    ->withStatus( 'processing' )
    ->create();
```

because it exclusively uses WooCommerce CRUD.

Woo's public HPOS API exposes detection through:

```php
OrderUtil::custom_orders_table_usage_is_enabled();
```

([The WooCommerce Developer Blog][2])

Storage switching, however, may require Woo internal machinery. That dependency should be hidden behind:

```php
interface OrderStorageAdapter
{
    public function ensureSchema(): void;

    public function activate( string $mode ): void;

    public function currentMode(): string;

    public function restore(): void;
}
```

The only code aware of Woo's internal HPOS controllers lives in an adapter.

---

# 20. Recommended storage modes

```php
final class OrderStorageMode
{
    public const CPT  = 'cpt';
    public const HPOS = 'hpos';

    private function __construct()
    {
    }
}
```

Optionally:

```php
public const HPOS_SYNC = 'hpos-sync';
```

for tests that specifically exercise synchronization.

But **HPOS compatibility/sync mode should not be your default HPOS test environment**.

Why?

Because synchronization can mask broken code that improperly writes through the CPT APIs. WooCommerce 10.7's disabling of sync-on-read illustrates exactly why testing against authoritative HPOS is necessary. ([The WooCommerce Developer Blog][3])

---

# 21. CI Should Drive HPOS/CPT

Recommended:

```text
WC_CORE_TEST_ORDER_STORAGE=cpt
WC_CORE_TEST_ORDER_STORAGE=hpos
```

Run the integration suite as two jobs.

For example:

```text
integration-php82-wc-current-cpt
integration-php82-wc-current-hpos
```

This is preferable to changing HPOS back and forth inside each test because it provides:

* clean process-level state;
* deterministic failures;
* fewer synchronization side effects;
* faster suites;
* clearer CI diagnostics.

Targeted Woo storage tests can still switch modes locally where needed.

---

# 22. Schema Lifecycle

At suite/class/bootstrap time:

```text
ensure HPOS schema exists
↓
do not repeatedly DROP/CREATE it
↓
run tests using transactions
```

If a suite-level cleanup is genuinely required:

```sql
DELETE FROM wp_wc_orders;
```

rather than:

```sql
TRUNCATE TABLE wp_wc_orders;
```

Current `HPOSToggleTrait::setup_cot_tables()` itself follows the “permanent tables + DELETE” pattern. ([GitHub][6])

Do not reset auto-increment simply to get predictable IDs.

Tests should regard generated IDs as opaque.

Bad:

```php
$this->assertSame( 12, $order->get_id() );
```

Good:

```php
$this->assertGreaterThan( 0, $order->get_id() );
```

or store the returned ID and compare relationships against it.

---

# 23. Boundary Seeders

Direct SQL is not forbidden.

It is simply a different test tool.

Good:

```php
OrderLookupSeeder::make()
    ->productId( $product_id )
    ->orderId( $order_id )
    ->quantity( 2 )
    ->insert();
```

when the production code under test is:

```php
SELECT SUM(...)
FROM wc_order_product_lookup
```

In that case forcing the full checkout/order calculation pipeline to create lookup rows adds cost without testing anything relevant.

Woo's current fixture guidance explicitly encourages seeding at the boundary read by the code, while retaining at least one real CRUD/write-path test for the corresponding subsystem. ([GitHub][1])

The architectural safeguard is:

```text
Fixture/*
    = production APIs

Seed/*
    = explicit storage-boundary manipulation
```

Never mix them.

---

# 24. Database Cleanup Strategy

## Tier 1 — per-test transaction

Default:

```text
WP_UnitTestCase transaction owns DB rollback.
```

Do not manually delete ordinary products/orders/users created after `parent::setUp()`.

---

## Tier 2 — package-owned in-memory state

Explicitly reset:

* Woo cart;
* session;
* notices;
* cart context;
* relevant Woo singleton caches;
* replaced logger;
* test-specific container overrides;
* locale caches.

This mirrors recent Woo core changes. ([GitHub][10])

---

## Tier 3 — state WordPress does not own

Track explicitly:

* files;
* external mock servers;
* nontransactional resources;
* schema created before the per-test transaction;
* class-level fixtures;
* process-level monkey patches.

Clean those explicitly.

---

# 25. Hooks

Do not do this in teardown:

```php
remove_all_filters( 'some_hook' );
```

unless the test created and exclusively owns that entire hook.

It can remove callbacks installed by:

* WooCommerce;
* WordPress;
* another fixture;
* plugin bootstrap;
* the test framework itself.

For ordinary WordPress integration tests, trust parent teardown to restore WordPress hook snapshots.

If code temporarily manipulates a hook during a test, restore the exact prior state:

```php
add_filter( $tag, $callback );

try {
    // test
} finally {
    remove_filter( $tag, $callback );
}
```

Woo core applies the same general principle when temporarily replacing global REST hook state: save it, run scoped callbacks, then restore the original in `finally`. ([GitHub][10])

---

# 26. Shipping Zones, Tax Rates and Fees

Do not introduce broad “wipe all zones/taxes” teardown.

Prefer ownership.

Example:

```php
$zone = ShippingZoneBuilder::make()->create();

$this->resources()->classScoped(
    'shipping-zone',
    $zone->get_id()
);
```

When explicit cleanup is required, delete only IDs created by the fixture.

For normal per-test inserts into transactional tables, rollback should own cleanup.

### Fees

Order fees persisted through Woo are part of the order and follow normal order transaction semantics.

Cart fees are process/cart state and should disappear when cart state is reset.

Thus a special global `DELETE fees` facility should not be necessary.

---

# 27. Resource Registry

A useful v2 primitive:

```php
$this->resources()->remember(
    'external-resource',
    $id,
    static function ( $id ): void {
        // exact cleanup
    }
);
```

Use this only for resources the base transaction does not own.

Avoid creating a framework that eagerly deletes everything at teardown; that simply adds work and creates more lifecycle bugs.

---

# 28. IntegrationTestCase

Recommended skeleton:

```php
<?php

declare(strict_types=1);

namespace Wpdev\WcCoreTest\Integration;

abstract class TestCase extends \WP_UnitTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->wooState()->prepare();
    }

    protected function tearDown(): void
    {
        try {
            $this->wooState()->reset();
            $this->resources()->clean();
        } finally {
            parent::tearDown();
        }
    }
}
```

That `finally` is non-negotiable.

Woo core now explicitly documents that failing to run parent teardown can skip transaction rollback and hook restoration, contaminating every later test. ([GitHub][10])

---

# 29. Store API and REST Testing

Do not fire every Woo REST registration hook for every integration test.

Woo's modern test guidance recommends registering only the REST namespace/surface required by the current test. ([GitHub][1])

`wc-core-test` could expose:

```php
$server = $this->rest()
    ->withWooNamespace( 'wc/store/v1' )
    ->server();
```

or:

```php
$response = $this->storeApi()
    ->post( '/cart/add-item', $payload );
```

This would be a useful high-level abstraction for Woo extensions because Store API contract testing can cover most server-side Blocks behavior without paying Playwright/browser cost.

---

# 30. PHP and Toolchain Compatibility

## PHP 7.4–8.3

PHP 7.4 compatibility is currently technically viable for the framework.

WordPress 7.0+ currently supports PHP 7.4+, and current WordPress documentation maps PHP 7.4–8.5 to PHPUnit 9 for modern WordPress versions. ([Make WordPress][25])

However, on September 8, 2026 WooCommerce proposed increasing its minimum PHP requirement to **PHP 8.1 starting with WooCommerce 11.5**, targeted for January 2027. The decision was still described as proposed/not finalized at the time of research. ([The WooCommerce Developer Blog][26])

Therefore:

> Keep `wc-core-test` v2 source PHP-7.4-compatible initially, but do not promise that PHP 7.4 can run every future WooCommerce version.

That is a compatibility-matrix issue rather than a framework-language issue.

---

## PHP 7.4-safe source rules

Use:

```php
declare(strict_types=1);
```

freely.

Avoid PHP 8-only syntax in v2:

```text
union types
match
attributes
constructor property promotion
enums
readonly
mixed type declarations
```

Use docblocks where necessary:

```php
/**
 * @param WC_Customer|int $customer
 */
public function withCustomer( $customer ): self
```

---

# 31. PHPUnit

Recommended baseline:

```json
"phpunit/phpunit": "^9.6"
```

This matches current Woo-owned extension practice; both WooPayments and Stripe currently use PHPUnit 9.6.34. ([GitHub][16])

`yoast/phpunit-polyfills` remains appropriate. Current 4.x supports PHPUnit 7.5–9.x as well as newer 11/12 families. ([Packagist][27])

For v2 I would:

* write tests against PHPUnit 9 conventions;
* use Polyfills for cross-version APIs where useful;
* avoid pretending PHPUnit 10+ support is part of the v2 contract until the WordPress/Woo matrix actually needs it.

---

# 32. Proposed CI Matrix

Do not Cartesian-product every version on every PR.

### PR fast lane

```text
PHP 8.2
current supported WordPress
current WooCommerce
CPT
HPOS
```

plus pure units on every supported PHP version.

### Compatibility lane

```text
PHP 7.4 + oldest supported Woo/WP combination
PHP 8.0 + compatible Woo
PHP 8.1 + representative Woo
PHP 8.2 + current Woo
PHP 8.3 + current Woo

Each important Woo combination:
    CPT
    HPOS
```

### Nightly/release

Add:

```text
Woo lowest supported
Woo latest stable
Woo next/beta/RC
WordPress lowest
WordPress latest
QIT compatibility
Playwright classic checkout
Playwright Blocks checkout
```

Once WooCommerce 11.5+ requires PHP 8.1, do not force that release into PHP 7.4 CI.

Instead:

```text
PHP 7.4 → last compatible WC range
PHP >=8.1 → newest WC range
```

---

# 33. Parallel Testing

ParaTest can provide major benefits; Woo Stripe already exposes a parallel PHPUnit command. ([GitHub][14])

But one condition is essential:

> Each PHP worker must have database/process isolation appropriate to your bootstrap.

Transactions isolate tests inside a process but do not magically make unsafe global DDL/shared-database manipulation safe across multiple processes.

Therefore v2 should first eliminate:

* DDL in per-test lifecycle;
* global table truncation;
* fixed IDs;
* non-namespaced shared resources;

before advertising parallel integration testing as reliable.

---

# 34. Audit of Legacy `wc-core-test` Antipatterns

| Legacy pattern                                | Risk                                     | v2 replacement                          |
| --------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| `Product::create_simple_product()` god helper | Hidden defaults and unnecessary work     | `ProductBuilder`                        |
| `Order::create_order()` for every test        | ~29 writes + hooks even when irrelevant  | Minimal builder by default              |
| Fluent method saves immediately               | Multiple writes per fixture              | Accumulate + single final save          |
| `TRUNCATE`                                    | Implicit commit destroys test rollback   | Transaction / targeted `DELETE`         |
| DROP/recreate HPOS tables per test            | DDL + global state                       | Prepare schema before transaction       |
| Direct `update_post_meta()` on orders         | HPOS incompatible                        | Woo order CRUD                          |
| Query `wp_posts` for `shop_order`             | HPOS implementation coupling             | `wc_get_order(s)` / CRUD/query API      |
| Assume order ID is post ID                    | Invalid storage assumption               | Treat WC order ID as opaque             |
| Direct coupon/product meta                    | Bypasses Woo data store/cache/hooks      | WC CRUD                                 |
| Builder silently turns HPOS on/off            | Hidden global state                      | Storage manager / CI mode               |
| Compatibility-mode-only HPOS testing          | Can hide illegal CPT writes              | HPOS authoritative test lane            |
| Reuse class-level `WC_Product` object         | In-memory mutations leak                 | Share ID; reload object                 |
| Reset auto increment                          | Brittle ID assumptions                   | Opaque IDs                              |
| `remove_all_filters()` teardown               | Deletes callbacks you do not own         | Parent restore / exact callback cleanup |
| Override teardown without `finally`           | Can skip rollback/hook restoration       | `try/finally parent::tearDown()`        |
| Do not reset cart/session/notices             | Cross-test process leakage               | `WooStateResetter`                      |
| Real cart inside pure unit suite              | Null session/global bootstrap failures   | Mock plugin-owned cart port             |
| Mock dozens of Woo functions                  | False confidence/implementation coupling | Plugin-owned adapters                   |
| Direct SQL hidden inside generic factory      | Bypasses behavior invisibly              | Explicit `Seed/*` classes               |
| Real network calls                            | Flaky/non-deterministic                  | HTTP interceptor/mock                   |
| `sleep()` for dates                           | Slow                                     | Inject/set explicit timestamps          |
| Full REST initialization in every test        | Expensive global registration            | Scoped namespace registration           |
| Random fixture defaults                       | Hard-to-reproduce failures               | Deterministic defaults                  |
| Old static helper removed immediately         | Massive migration cost                   | Deprecated façade → new builder         |

---

# 35. Concrete v2 API Specification

## Basic fixtures

```php
$product = ProductBuilder::simple()
    ->named( 'Test Product' )
    ->pricedAt( '19.99' )
    ->create();
```

```php
$customer = CustomerBuilder::make()
    ->withEmail( 'customer@example.test' )
    ->create();
```

```php
$order = OrderBuilder::make()
    ->withCustomer( $customer )
    ->withProduct( $product, 2 )
    ->withStatus( 'processing' )
    ->create();
```

```php
$coupon = CouponBuilder::make()
    ->withCode( 'SAVE20' )
    ->percentage( 20 )
    ->create();
```

---

## Low-cost order

```php
$order = OrderBuilder::make()
    ->withCustomerId( $customer_id )
    ->withStatus( 'processing' )
    ->create();
```

Implementation should effectively choose the minimal Woo CRUD path.

---

## Full behavioral order

```php
$order = OrderBuilder::make()
    ->withCustomer( $customer )
    ->withProduct( $product, 2 )
    ->withBillingAddress( $address )
    ->withShippingAddress( $address )
    ->calculateTaxes()
    ->calculateTotals()
    ->create();
```

---

## Read-boundary seed

```php
$row = OrderLookupSeeder::make()
    ->forOrder( $order_id )
    ->forProduct( $product_id )
    ->quantity( 10 )
    ->netRevenue( '100.00' )
    ->insert();
```

Naming it `Seeder` communicates:

> “This test is deliberately bypassing Woo's write path.”

---

# 36. Legacy Compatibility Layer

Do not force all existing plugins to migrate in one release.

```php
final class Order
{
    /**
     * @deprecated since wc-core-test 2.0.
     * Use OrderBuilder instead.
     */
    public static function create_order()
    {
        return OrderBuilder::legacyDefaults()->create();
    }
}
```

Important:

`legacyDefaults()` should retain old fixture semantics.

Do **not** make an old helper suddenly create a materially different order just because v2 has a more efficient API. That introduces subtle test regressions.

Migration should be:

```text
v2.0
old API works + deprecated
new API preferred

v2.x
migration tooling/documentation

v3.0
optional removal of legacy façade
```

---

# 37. API Design Principle: Explicit Cost

Builder naming should reveal expensive behavior.

Good:

```php
->calculateTotals()
->applyCoupon()
->paymentCompleted()
->withGeneratedItems( 5 )
```

Potentially misleading:

```php
->realistic()
->complete()
->standard()
```

because no caller knows what those entail.

The fixture ladder should be visible from the test itself.

---

# 38. Performance Guardrail

Woo core currently flags tests slower than one second with its SpeedTrap listener. ([GitHub][1])

Add an equivalent CI review threshold.

Suggested policy:

```text
Pure unit:
  target individual tests <10–20 ms

Integration:
  review >250 ms
  flag >1 s

E2E:
  separate suite; no PR-level expectation of millisecond execution
```

The exact numbers can be tuned from baseline measurements.

The important part is automatically surfacing regressions.

---

# 39. Recommended Roadmap

## Phase 0 — Audit and Freeze

Before changing APIs:

1. inventory every existing static helper;
2. measure helper write/query count;
3. find `TRUNCATE`, DDL, `update_post_meta`, `wp_insert_post`, direct order SQL;
4. find tests relying on exact IDs;
5. find tests requiring session/cart globals;
6. classify every helper by fixture ladder rung.

Do not change behavior yet.

---

## Phase 1 — Isolation Foundation

Implement first:

```text
Integration\TestCase
WooStateResetter
OrderStorageManager
Compatibility adapters
ResourceRegistry
```

Acceptance criteria:

* no test helper uses `TRUNCATE`;
* parent teardown always runs;
* tests pass in randomized order;
* cart/notices do not leak;
* HPOS schema is not recreated per test.

This is more important than builders.

---

## Phase 2 — New Fixture API

Implement:

```text
ProductBuilder
OrderBuilder
CustomerBuilder
CouponBuilder
RefundBuilder
```

Rules:

* deterministic defaults;
* no storage-mode knowledge;
* Woo CRUD only;
* no implicit `save()` during fluent configuration;
* minimal fixture by default.

---

## Phase 3 — Fixture Ladder / Seeders

Add:

```text
OrderRowSeeder
LookupTableSeeder
MigrationSourceSeeder
```

Document each as test-boundary-only.

Add a policy:

> Every subsystem using raw boundary seeding must retain at least one integration test of its real production write path.

This mirrors Woo core's current recommendation. ([GitHub][1])

---

## Phase 4 — HPOS Matrix

Introduce:

```text
WC_CORE_TEST_ORDER_STORAGE=cpt
WC_CORE_TEST_ORDER_STORAGE=hpos
```

Run both in CI.

Add optional synchronization mode only for code actually concerned with compatibility synchronization.

Do not require ordinary test methods to manually toggle HPOS.

---

## Phase 5 — Pure Unit Layer

Create an optional `wpdev/wc-core-test-unit` companion or documented unit profile with:

```text
PHPUnit
Brain Monkey
Mockery
optional Yoast WP Test Utils
```

Brain Monkey 2.7 and Mockery 1.6 remain current choices in 2026. ([Packagist][22])

Encourage plugins to move business logic behind ports/adapters.

A healthy plugin should eventually have substantially more pure domain tests than DB-backed tests.

---

## Phase 6 — Store API / Blocks

Add server-side Store API helpers.

Then provide reference Playwright/QIT configurations rather than embedding browser infrastructure into the core PHP fixture library.

Recommended coverage:

```text
Classic checkout
Blocks checkout
Store API server contract
```

---

## Phase 7 — Legacy Migration

Keep:

```text
Product::create_simple_product()
Order::create_order()
```

as deprecated wrappers during v2.

Internally route them to compatibility builders.

Then publish automated migration examples:

```diff
- $product = Product::create_simple_product();
+ $product = ProductBuilder::simple()->create();
```

and:

```diff
- $order = Order::create_order();
+ $order = OrderBuilder::make()
+     ->withProduct( $product )
+     ->create();
```

---

# 40. Proposed Quality Gates for `wc-core-test` Itself

A release of v2 should not be considered ready until all of these hold:

### Isolation

* suite succeeds in randomized order;
* same suite succeeds twice in one process;
* no `TRUNCATE`;
* no uncontrolled DDL;
* no fixed-ID dependence;
* hooks restored;
* Woo singleton state restored.

### HPOS

* builder tests pass in authoritative CPT;
* same builder tests pass in authoritative HPOS;
* no order factory calls `update_post_meta`;
* no order factory directly manipulates `wp_posts`.

### Performance

* minimal order path measured separately from full order fixture;
* no accidental full fixture inside query/count tests;
* tests >1 second surfaced automatically.

### Architecture

* no plugin-facing class imports Woo's `/tests` namespace;
* internal Woo dependencies live under `Compatibility`;
* direct SQL exists only under `Seed`/storage-specific infrastructure;
* pure-unit bootstrap does not load WordPress.

### Toolchain

* PHP 7.4, 8.0, 8.1, 8.2, 8.3 where corresponding Woo versions support them;
* PHPUnit 9.6;
* strict types;
* PHPUnit Polyfills;
* PHPStan;
* Composer lowest/highest dependency checks.

---

# 41. Final Architecture Recommendation

The optimal `wc-core-test` v2 is **not a clone of WooCommerce's internal helpers**.

It should become a deliberately thin testing architecture around WooCommerce's public contract.

The target dependency model is:

```text
                      ┌─────────────────────┐
                      │ Plugin Domain Tests │
                      │ Mockery / pure PHP  │
                      └──────────┬──────────┘
                                 │
                         plugin-owned ports
                                 │
             ┌───────────────────┴───────────────────┐
             │                                       │
      Pure Unit Adapters                      Integration Tests
      Brain Monkey optional                         │
                                                     ▼
                                          wc-core-test builders
                                                     │
                                             Woo CRUD APIs
                                                     │
                                      ┌──────────────┴──────────────┐
                                      │                             │
                                     CPT                           HPOS
                                      │                             │
                                      └────────── CI matrix ────────┘

                        Outer compatibility layer
                    Store API / QIT / Playwright
```

The most consequential choices are:

**1. Make fixture fidelity explicit.**
Default builders should create the smallest useful persisted entity. Add items, shipping, taxes, totals, payments, etc. only when requested.

**2. Treat HPOS as environment configuration.**
A CRUD builder should not care whether Woo is using CPT or HPOS.

**3. Do not couple v2's public API to Woo's test directory.**
Borrow Woo's patterns, not its internal classes.

**4. Let WordPress own transactional cleanup.**
Use manual deletion only for state outside that contract.

**5. Treat process state as a first-class cleanup concern.**
Database rollback cannot reset sessions, carts, notices, caches or singleton properties.

**6. Separate seeders from factories.**
Direct persistence seeding is valuable, but only when visible and deliberate.

**7. Push business logic out of Woo globals.**
Brain Monkey is useful, but plugin-owned interfaces are the real route to consistently sub-second unit suites.

**8. Keep PHP 7.4 compatibility as a v2 implementation constraint, not an eternal Woo support promise.**
WooCommerce has already proposed PHP 8.1 as its minimum for 11.5+, so CI must map PHP versions to compatible Woo releases rather than assuming every PHP lane can always run latest Woo. ([The WooCommerce Developer Blog][26])

---

# Sources / Primary Evidence

The principal conclusions above are grounded primarily in:

* WooCommerce current test-suite README and its fixture-ladder/isolation guidance. ([GitHub][1])
* WooCommerce current `HPOSToggleTrait`. ([GitHub][6])
* WooCommerce current `HposTestCase`. ([GitHub][5])
* WooCommerce `MetaDataAssertionTrait`, `LoggerSpyTrait`, and `SerializingCacheTrait`. ([GitHub][7])
* WooCommerce current base test lifecycle/session/cart cleanup. ([GitHub][10])
* Official HPOS extension migration guidance. ([The WooCommerce Developer Blog][2])
* WooCommerce 10.7 HPOS sync-on-read advisory. ([The WooCommerce Developer Blog][3])
* WooPayments, Stripe and PayPal public testing infrastructure. ([GitHub][11])
* Level Level wp-browser WooCommerce factories. ([Packagist][18])
* WooCommerce QIT CLI. ([Packagist][19])
* WooCommerce Smooth Generator and Human Made demo generator. ([Packagist][21])
* Brain Monkey, Mockery and Yoast WP Test Utils. ([Packagist][22])
* Current WordPress PHP/PHPUnit compatibility and WooCommerce's proposed future PHP requirement. ([Make WordPress][25])

The highest-value implementation sequence is **isolation/state lifecycle → storage-mode adapter → builders → boundary seeders → legacy wrappers**, rather than starting with fluent syntax. That ordering fixes the architectural risks first and lets the new builder API sit on a trustworthy foundation.

[1]: https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/README.md "https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/README.md"
[2]: https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/ "https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/"
[3]: https://developer.woocommerce.com/2026/02/16/hpos-sync-on-read-to-be-disabled-by-default-in-woocommerce-10-7/ "https://developer.woocommerce.com/2026/02/16/hpos-sync-on-read-to-be-disabled-by-default-in-woocommerce-10-7/"
[4]: https://github.com/Automattic/wc-extensions-code-test-guide "https://github.com/Automattic/wc-extensions-code-test-guide"
[5]: https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/HposTestCase.php "https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/HposTestCase.php"
[6]: https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/HPOSToggleTrait.php "https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/HPOSToggleTrait.php"
[7]: https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/MetaDataAssertionTrait.php "https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/MetaDataAssertionTrait.php"
[8]: https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/LoggerSpyTrait.php "https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/LoggerSpyTrait.php"
[9]: https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/SerializingCacheTrait.php "https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/php/helpers/SerializingCacheTrait.php"
[10]: https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/legacy/framework/class-wc-unit-test-case.php "https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/tests/legacy/framework/class-wc-unit-test-case.php"
[11]: https://github.com/Automattic/woocommerce-payments "https://github.com/Automattic/woocommerce-payments"
[12]: https://github.com/Automattic/woocommerce-payments/blob/develop/composer.json "https://github.com/Automattic/woocommerce-payments/blob/develop/composer.json"
[13]: https://github.com/Automattic/woocommerce-payments/blob/develop/.claude/review-rules.md "https://github.com/Automattic/woocommerce-payments/blob/develop/.claude/review-rules.md"
[14]: https://github.com/woocommerce/woocommerce-gateway-stripe "https://github.com/woocommerce/woocommerce-gateway-stripe"
[15]: https://github.com/woocommerce/woocommerce-gateway-stripe/blob/develop/AGENTS.md "https://github.com/woocommerce/woocommerce-gateway-stripe/blob/develop/AGENTS.md"
[16]: https://github.com/woocommerce/woocommerce-gateway-stripe/blob/develop/composer.json "https://github.com/woocommerce/woocommerce-gateway-stripe/blob/develop/composer.json"
[17]: https://github.com/woocommerce/woocommerce-paypal-payments/blob/dev/develop/AGENTS.md "https://github.com/woocommerce/woocommerce-paypal-payments/blob/dev/develop/AGENTS.md"
[18]: https://packagist.org/packages/level-level/wp-browser-woocommerce "https://packagist.org/packages/level-level/wp-browser-woocommerce"
[19]: https://packagist.org/packages/woocommerce/qit-cli "https://packagist.org/packages/woocommerce/qit-cli"
[20]: https://packagist.org/packages/humanmade/woocommerce-demo-generator "https://packagist.org/packages/humanmade/woocommerce-demo-generator"
[21]: https://packagist.org/packages/woocommerce/wc-smooth-generator "https://packagist.org/packages/woocommerce/wc-smooth-generator"
[22]: https://packagist.org/packages/brain/monkey "https://packagist.org/packages/brain/monkey"
[23]: https://packagist.org/packages/mockery/mockery "https://packagist.org/packages/mockery/mockery"
[24]: https://github.com/Yoast/wp-test-utils "https://github.com/Yoast/wp-test-utils"
[25]: https://make.wordpress.org/core/2026/05/22/php-support-clarification-2026/ "https://make.wordpress.org/core/2026/05/22/php-support-clarification-2026/"
[26]: https://developer.woocommerce.com/2026/09/08/from-php-7-4-to-8-1/ "https://developer.woocommerce.com/2026/09/08/from-php-7-4-to-8-1/"
[27]: https://packagist.org/packages/yoast/phpunit-polyfills "https://packagist.org/packages/yoast/phpunit-polyfills"
