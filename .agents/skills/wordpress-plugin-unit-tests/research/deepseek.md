# Modernizing WooCommerce Unit & Integration Testing Architecture: A Deep Architectural Research Report

---

## 1. Executive Summary & Ecosystem Reality Check

The WooCommerce testing ecosystem in 2025–2026 is characterized by a fundamental structural tension: WooCommerce core has invested heavily in a sophisticated, multi-layered testing infrastructure, yet **none of it is consumable as a standalone, decoupled Composer package** by third-party plugin developers. The core repository contains `HposTestCase`, `HPOSToggleTrait`, `OrderHelper`, `MetaDataAssertionTrait`, `LoggerSpyTrait`, and dozens of specialized test utilities—all locked inside the monorepo's `plugins/woocommerce/tests/` directory. Third-party developers must either copy-paste these helpers (creating maintenance burden and divergence), use `--prefer-source` Composer installs of the entire WooCommerce repository (pulling in ~100MB of test fixtures they don't need), or rely on community-maintained extracted packages of varying quality.

Simultaneously, the testing landscape has bifurcated. **Brain Monkey + Mockery** enables genuinely sub-second pure unit tests for WooCommerce plugin logic by mocking WordPress and WooCommerce functions at the PHP level, while **wp-browser integration tests** (extended by packages like `level-level/wp-browser-woocommerce`) provide real MySQL-backed verification of CRUD operations, HPOS synchronization, and hook integrations. The emerging consensus is a **hybrid model**: ~70% of tests as pure unit tests (Brain Monkey), ~25% as integration tests (WP_UnitTestCase + WooCommerce helpers), and ~5% as E2E (Playwright/QIT).

The most critical architectural shift for `wc-core-test` v2.0 is recognizing that **static monolithic helpers are no longer viable**. The Fluent Builder pattern—`OrderBuilder::new()->withCustomer($user)->withItems(2)->paid()->create()`—provides the composability, type safety, and HPOS-agnostic behavior that legacy static factories cannot. Combined with strict typing, PHPUnit 9.6 compatibility, PHP 7.4–8.3 support, and safe `DELETE FROM`-based teardown (replacing `TRUNCATE`), this architecture positions `wc-core-test` v2.0 as a genuinely modern, decoupled testing framework that mirrors WooCommerce core's internal quality standards without inheriting its monorepo coupling.

---

## 2. Deep-Dive Findings per Pillar

### Pillar 1: WooCommerce Core Testing Internals & Fixture Ladders

#### 1.1 HposTestCase and HPOSToggleTrait

WooCommerce core's HPOS testing strategy is built around two central abstractions:

**`HposTestCase`** is the base test case class for any test that exercises order storage. It extends `WC_Unit_Test_Case` and provides HPOS-specific lifecycle management. A typical usage pattern from the core repository:

```php
class OrdersTableDataStoreTests extends HposTestCase {
    use HPOSToggleTrait;
    use CogsAwareUnitTestSuiteTrait;

    private $sut; // System Under Test
    private $cpt_data_store;
    private $cot_state;

    public function setUp(): void {
        parent::setUp();
        // HPOS-specific initialization
    }

    public function tearDown(): void {
        // Cleanup
        parent::tearDown();
    }
}
```



**`HPOSToggleTrait`** provides the runtime mechanism for switching between HPOS and legacy CPT storage during tests:

```php
trait HPOSToggleTrait {
    public function toggle_cot_feature_and_usage($enable) {
        // Toggle the HPOS feature flag AND the actual storage usage
    }
    public function enable_cot_sync() {
        // Enable HPOS ↔ CPT data synchronization
    }
    public function disable_cot_sync() {
        // Disable synchronization (pure HPOS mode)
    }
}
```



The critical insight is that `toggle_cot_feature_and_usage()` does **two** things: it flips the `woocommerce_custom_orders_table_enabled` option (the feature flag), and it updates the `woocommerce_custom_orders_table_data_sync_enabled` option (the synchronization state). Tests that only toggle the feature flag but leave sync enabled will produce misleading results, because orders created via HPOS will still backfill to the `wp_posts` table. Core's `LegacyDataCleanupTests` validates that cleanup operations are only permitted when HPOS is active **and** compat mode (synchronization) is disabled—a crucial invariant that third-party plugins should replicate in their own HPOS-aware tests.

#### 1.2 The Modern "Fixture Ladder" Principle

While the term "Fixture Ladder" does not appear as a formal named concept in WooCommerce core documentation, the principle is clearly observable in the codebase's testing patterns. It describes a **hierarchy of fixture creation strategies**, each appropriate for different test scopes:

| Rung | Strategy | Use Case | Cost | Fidelity |
|------|----------|----------|------|----------|
| **1 (Top)** | `WC_Helper_Order::create_order()` | Integration tests needing full order with products, shipping, payment | ~200ms | Highest |
| **2** | `wc_create_order()` + minimal items | Unit-integration boundary tests | ~50ms | Medium |
| **3** | Direct CRUD (`$order = new WC_Order(); $order->set_status('completed'); $order->save();`) | Testing specific data store behavior | ~20ms | Medium-Low |
| **4 (Bottom)** | Direct table seeding (`$wpdb->insert('wp_wc_orders', [...])`) | Data store internals, HPOS migration tests | ~5ms | Lowest |

The core repository explicitly documents this in its test helper hierarchy. `OrderHelper::create_order()` sits at the top of the ladder for integration tests, while lower-level tests in `tests/php/src/Internal/DataStores/` use direct table seeding to isolate data store logic from CRUD overhead.

**Recommendation for `wc-core-test` v2.0:** Expose all four rungs as explicit builder methods, with documentation guiding developers toward the appropriate rung for their test scope.

#### 1.3 Core Traits and Lifecycle Helpers Worth Adopting

WooCommerce core contains several test traits that third-party plugins should replicate or extract:

**`MetaDataAssertionTrait`** — provides assertion methods for verifying order and product meta data without direct database queries. This is critical for HPOS compatibility because meta data may reside in either `wp_postmeta` (CPT mode) or `wp_wc_orders_meta` (HPOS mode). The trait abstracts this difference behind assertions like `assertOrderMetaEquals()`.

**`LoggerSpyTrait`** — captures WooCommerce log entries during test execution, allowing assertions on logging behavior. This is invaluable for plugins that conditionally log errors or debug information.

**`SerializingCacheTrait`** — exercises cache serialization/deserialization paths, which is essential for plugins that use object caching with WooCommerce data objects. Without this, cache-related bugs only manifest in production.

**`CogsAwareUnitTestSuiteTrait`** — a newer trait that handles Cost of Goods Sold (COGS) feature toggling, demonstrating the pattern for feature-flag-aware testing.

#### 1.4 Dangerous Practices in Legacy Test Suites

The most dangerous antipattern in legacy WooCommerce test suites is **`TRUNCATE TABLE`**. This command causes an **implicit MySQL COMMIT**, which breaks the `WP_UnitTestCase` transaction rollback mechanism. When a test uses `TRUNCATE`, any changes made during that test **cannot be rolled back**, causing cascading failures in subsequent tests. WooCommerce core itself has recognized this and actively migrated away from `TRUNCATE`: a 2026 commit explicitly updates the "Delete WooCommerce tax rates" tool from `TRUNCATE` to `DELETE` "to keep auto increment IDs" and maintain transaction integrity.

The second critical antipattern is **direct `update_post_meta()` on orders and coupons**. In HPOS mode, order meta lives in `wp_wc_orders_meta`, not `wp_postmeta`. Code that calls `update_post_meta($order_id, ...)` will silently fail (or write to the wrong table) when HPOS is active. Similarly, `update_post_meta()` on coupon IDs bypasses the `WC_Coupon` CRUD object, missing validation, hooks, and cache invalidation. All meta operations must go through the CRUD layer: `$order->update_meta_data()`, `$order->save()`, `$coupon->update_meta_data()`, `$coupon->save()`.

A third antipattern is **relying on `get_post_meta()` for order data in tests that are supposed to be HPOS-compatible**. Even if the test passes in CPT mode, it will fail in HPOS mode. The correct approach is `$order->get_meta()`.

---

### Pillar 2: Community & Commercial Extension Testing Patterns

#### 2.1 How Top-Tier Developers Structure Tests

**Automattic/WooCommerce Marketplace teams** rely heavily on the **QIT (Quality Insights Toolkit)** platform for E2E and API testing of canonical extensions. QIT provides standardized test packages that extensions can compose: `makePurchase` for payment gateways, `calculateShipping` for shipping plugins, `calculateTax` for tax plugins, and `verifyEmailSent` for email integrations. The pattern is **declarative test package composition** rather than bespoke test harness construction.

**Level Level** (a prominent Dutch WooCommerce agency) maintains `level-level/wp-browser-woocommerce`, the most actively maintained community package for WooCommerce integration testing. It extends `wp-browser`'s `WPTestCase` with WooCommerce-specific factories accessed via `$this->factory()->product->create_and_get()` and `$this->factory()->order->create_and_get()`. Notably, these factories use **internal REST API method calls** rather than direct database inserts, ensuring that all hooks, validation, and data store logic execute during fixture creation.

**Greys** (jgreys) maintains `greys/woocommerce-phpunit-framework`, a standalone extraction of WooCommerce's `WC_Unit_Test_Case` and helper classes. Version 5.0 supports WooCommerce 6.5+ and provides the classic `WC_Helper_Product::create_simple_product()` API. This package is essentially a **frozen extraction** of core's helpers, which means it will progressively diverge as core evolves.

**YITH, Barn2, and WPDesk** generally follow a **dual-layer pattern**: a `tests/unit/` directory with Brain Monkey-based pure unit tests (fast, no MySQL), and a `tests/integration/` directory with `WP_UnitTestCase` + WooCommerce helpers (slower, MySQL-backed). The unit tests run on every commit; integration tests run on PRs and releases.

#### 2.2 Actively Maintained Composer Packages

| Package | Maintainer | Last Update | WooCommerce Support | Approach |
|---------|-----------|-------------|---------------------|----------|
| `level-level/wp-browser-woocommerce` | Level Level | Feb 2025 | 6.5+ | wp-browser extension, factory-based |
| `greys/woocommerce-phpunit-framework` | jgreys | Oct 2025 | 6.5+ | Standalone extraction of core helpers |
| `woocommerce/qit-cli` | WooCommerce | Active | All | E2E/API testing platform |
| `humanmade/woocommerce-demo-generator` | Human Made | Intermittent | Variable | Demo data generation (not testing-focused) |

The **critical gap** is that none of these provide a Fluent Builder API, none handle HPOS toggling transparently, and none offer safe teardown traits for shipping zones, tax rates, or fees.

#### 2.3 Why WooCommerce Has No `woocommerce/test-framework` Package

The absence of a standalone `woocommerce/test-framework` Composer package is **architectural, not accidental**. WooCommerce's test helpers have deep coupling to:

1. **The monorepo's autoloader** — test helpers reference internal classes via PSR-4 autoloading that assumes the WooCommerce source tree is present.
2. **Test fixtures and SQL dumps** — integration tests depend on `.sql` fixture files and seed data that are large and path-dependent.
3. **The `wc_get_container()` dependency injection container** — many helpers resolve services through WooCommerce's DI container, which requires a fully booted WooCommerce environment.
4. **Release cycle coupling** — a standalone package would need version negotiation with WooCommerce core, WordPress, and PHPUnit, creating a matrix of compatibility that Automattic has historically avoided.

The cleanest workaround, used by sophisticated CI pipelines, is the **Composer `--prefer-source` + path repository** approach:

```json
{
    "repositories": [
        {
            "type": "package",
            "package": {
                "name": "woocommerce/woocommerce-test-framework",
                "version": "9.0.0",
                "source": {
                    "type": "git",
                    "url": "https://github.com/woocommerce/woocommerce.git",
                    "reference": "release/9.0"
                },
                "autoload": {
                    "classmap": [
                        "plugins/woocommerce/tests/Tools/",
                        "plugins/woocommerce/tests/legacy/framework/"
                    ]
                }
            }
        }
    ]
}
```

This approach loads only the test framework directories via classmap autoloading, avoiding the need to install the entire WooCommerce repository as a dependency. A second workaround is the **Symlink Approach**: CI scripts create a symlink from `vendor/woocommerce/woocommerce/tests/framework` to a checked-out WooCommerce source tree, then run PHPUnit with the WooCommerce bootstrap.

---

### Pillar 3: Fast Unit Testing vs. Heavy Integration Testing (The Hybrid Model)

#### 3.1 Brain Monkey + Mockery for Sub-Second Unit Tests

Brain Monkey provides two namespaces for mocking: `Brain\Monkey\Functions` (for WordPress/WooCommerce functions) and `Brain\Monkey\Actions`/`Brain\Monkey\Filters` (for hooks). The key pattern for WooCommerce plugin unit testing:

```php
use Brain\Monkey;
use Brain\Monkey\Functions;
use Mockery;
use PHPUnit\Framework\TestCase;

class PriceCalculatorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
    }

    protected function tearDown(): void
    {
        Monkey\tearDown();
        Mockery::close();
        parent::tearDown();
    }

    public function test_calculate_discounted_price(): void
    {
        // Mock WooCommerce function
        Functions\when('wc_get_product')->justReturn(
            Mockery::mock('WC_Product', [
                'get_price' => 100.00,
                'is_on_sale' => false,
            ])
        );

        Functions\when('wc_price')->returnArg(); // Identity for testing

        $calculator = new PriceCalculator();
        $result = $calculator->calculate(42, 0.1);

        $this->assertEquals(90.00, $result);
    }
}
```

**Where the dividing line falls:**

| Test Category | Framework | Speed | MySQL | WordPress Boot |
|---------------|-----------|-------|-------|----------------|
| Pure business logic (price calc, discount rules) | Brain Monkey + Mockery | < 50ms | No | No |
| Function-level WooCommerce integration (hooks firing) | Brain Monkey + action/filter expectations | < 100ms | No | No |
| CRUD operations (order/product persistence) | WP_UnitTestCase + WooCommerce helpers | 200–500ms | Yes | Yes |
| HPOS synchronization | HposTestCase + HPOSToggleTrait | 500ms–2s | Yes | Yes |
| Session/cart behavior | WP_UnitTestCase + WC session setup | 300–800ms | Yes | Yes |

The **rule of thumb**: if a test can be written without ever calling `$order->save()` or `$product->save()`, it belongs in the Brain Monkey layer. If it needs to verify that data persists correctly, it belongs in the integration layer.

#### 3.2 Handling Sessions, Carts, and Notices in Isolated Tests

The `Call to a member function get() on null` error is almost always caused by `WC()->session` being null. In integration tests, the session must be explicitly initialized:

```php
protected function setUp(): void
{
    parent::setUp();
    
    // Ensure WC session is initialized
    if (!WC()->session) {
        WC()->session = new WC_Session_Handler();
        WC()->session->init();
    }
    
    // Ensure cart is initialized
    if (!WC()->cart) {
        WC()->cart = new WC_Cart();
    }
    
    // Clear any existing notices
    wc_clear_notices();
}

protected function tearDown(): void
{
    // Clean up session data
    if (WC()->session) {
        WC()->session->cleanup_sessions();
    }
    
    // Reset notices
    wc_clear_notices();
    
    parent::tearDown();
}
```

WooCommerce core itself has adopted this pattern: a 2025 PR explicitly adds teardown logic to "clean up any test-created Woo session cookies (and cart)" and "ensure cart is cleared between tests". For pure unit tests (Brain Monkey), session handling is entirely mocked:

```php
Functions\when('WC')->justReturn(Mockery::mock('WooCommerce', [
    'session' => Mockery::mock('WC_Session', [
        'get' => null,
    ]),
    'cart' => Mockery::mock('WC_Cart'),
]));
```

---

### Pillar 4: Recommended Architecture for `wc-core-test` v2.0

#### 4.1 Design Pattern: Fluent Builders / Factories

The v2.0 API should replace static helpers with **immutable Fluent Builders** that compose test fixtures declaratively:

```php
// Legacy (v1.x)
$order = Order::create_order($customer_id, $product_id, 2);

// v2.0 Fluent Builder
$order = OrderBuilder::new()
    ->withCustomer($user)
    ->withItems(2)
    ->withShippingMethod('flat_rate')
    ->withPaymentMethod('bacs')
    ->paid()
    ->create();
```

The builder architecture should be:

```php
declare(strict_types=1);

namespace WPDev\WCCoreTest\Builder;

abstract class AbstractBuilder
{
    protected array $state = [];
    protected ?object $created = null;

    public static function new(): static
    {
        return new static();
    }

    abstract public function create(): object;

    protected function reset(): void
    {
        $this->state = [];
        $this->created = null;
    }
}

final class OrderBuilder extends AbstractBuilder
{
    private ?int $customerId = null;
    private array $items = [];
    private ?string $paymentMethod = null;
    private bool $isPaid = false;
    private ?string $status = null;

    public function withCustomer(\WP_User|int $user): self
    {
        $this->customerId = is_int($user) ? $user : $user->ID;
        return $this;
    }

    public function withItems(int $quantity, ?\WC_Product $product = null): self
    {
        $this->items[] = [
            'product' => $product ?? ProductBuilder::new()->simple()->create(),
            'quantity' => $quantity,
        ];
        return $this;
    }

    public function withPaymentMethod(string $method): self
    {
        $this->paymentMethod = $method;
        return $this;
    }

    public function paid(): self
    {
        $this->isPaid = true;
        return $this;
    }

    public function create(): \WC_Order
    {
        $order = wc_create_order(['customer_id' => $this->customerId]);
        
        foreach ($this->items as $item) {
            $order->add_product($item['product'], $item['quantity']);
        }
        
        if ($this->paymentMethod) {
            $order->set_payment_method($this->paymentMethod);
        }
        
        if ($this->isPaid) {
            $order->payment_complete();
        }
        
        $order->save();
        
        return $order;
    }
}
```

#### 4.2 HPOS & Data Store Compatibility

Every builder must automatically detect and respect the active order storage mode:

```php
trait HposAwareTrait
{
    protected function isHposEnabled(): bool
    {
        return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
    }

    protected function withHposMode(string $mode): self
    {
        // mode: 'auto', 'hpos', 'cpt', 'sync'
        switch ($mode) {
            case 'hpos':
                $this->toggleHpos(true, false);
                break;
            case 'cpt':
                $this->toggleHpos(false, false);
                break;
            case 'sync':
                $this->toggleHpos(true, true);
                break;
        }
        return $this;
    }

    private function toggleHpos(bool $feature, bool $sync): void
    {
        update_option('woocommerce_custom_orders_table_enabled', $feature ? 'yes' : 'no');
        update_option('woocommerce_custom_orders_table_data_sync_enabled', $sync ? 'yes' : 'no');
    }
}
```

The builder's `create()` method should use **CRUD APIs exclusively**—never direct `update_post_meta()` or `$wpdb->insert()` into `wp_posts`. For HPOS mode, CRUD operations are automatically routed to `OrdersTableDataStore`; for CPT mode, to `CPTDataStore`. The builder doesn't need to know which mode is active—it simply calls `$order->save()`, and WooCommerce's data store routing handles the rest.

#### 4.3 Database & State Cleanup

**Replace `TRUNCATE` with `DELETE FROM`** across all teardown logic:

```php
trait SafeTeardownTrait
{
    protected function safeDeleteFrom(string $table, string $where = ''): void
    {
        global $wpdb;
        $sql = "DELETE FROM {$table}";
        if ($where) {
            $sql .= " WHERE {$where}";
        }
        $wpdb->query($sql);
    }

    protected function cleanupWooCommerceState(): void
    {
        // Orders (both HPOS and CPT)
        $this->safeDeleteFrom($wpdb->prefix . 'wc_orders');
        $this->safeDeleteFrom($wpdb->prefix . 'wc_orders_meta');
        $this->safeDeleteFrom($wpdb->prefix . 'wc_order_items');
        $this->safeDeleteFrom($wpdb->prefix . 'wc_order_itemmeta');
        
        // Products
        $this->safeDeleteFrom($wpdb->prefix . 'wc_product_meta_lookup');
        
        // Shipping zones
        $this->safeDeleteFrom($wpdb->prefix . 'woocommerce_shipping_zones');
        $this->safeDeleteFrom($wpdb->prefix . 'woocommerce_shipping_zone_locations');
        $this->safeDeleteFrom($wpdb->prefix . 'woocommerce_shipping_zone_methods');
        
        // Tax rates
        $this->safeDeleteFrom($wpdb->prefix . 'woocommerce_tax_rates');
        $this->safeDeleteFrom($wpdb->prefix . 'woocommerce_tax_rate_locations');
        
        // Fees and coupons
        $this->safeDeleteFrom($wpdb->prefix . 'woocommerce_order_items', "order_item_type = 'fee'");
        $this->safeDeleteFrom($wpdb->prefix . 'posts', "post_type = 'shop_coupon'");
        
        // Clear WooCommerce caches
        wc_delete_shop_order_transients();
        WC_Cache_Helper::invalidate_cache_group('orders');
    }
}
```

Additionally, the teardown should **restore WordPress hooks** that were modified during tests:

```php
protected function restoreHooks(array $originalHooks): void
{
    global $wp_filter;
    $wp_filter = $originalHooks;
}
```

#### 4.4 PHP & Toolchain Compatibility

**Strict typing** must be enforced at the file level in every v2.0 source file:

```php
<?php
declare(strict_types=1);
```

**PHP version support matrix:**

| PHP Version | Support Level | Notes |
|-------------|---------------|-------|
| 7.4 | Full | Minimum supported version |
| 8.0 | Full | Union types available |
| 8.1 | Full | Enums, readonly properties |
| 8.2 | Full | DNF types |
| 8.3 | Full | `json_validate()`, typed class constants |

**PHPUnit compatibility:** v2.0 should target **PHPUnit 9.6** as the primary version, with polyfills for `assertEqualsWithDelta()` and other PHPUnit 10+ features via `yoast/phpunit-polyfills`. The `yoast/wp-test-utils` package provides Brain Monkey integration and pre-stubbed WordPress functions, simplifying the mocking layer.

**Composer `composer.json` for v2.0:**

```json
{
    "name": "wpdev/wc-core-test",
    "description": "Modern WooCommerce testing framework with Fluent Builders",
    "type": "library",
    "license": "MIT",
    "require": {
        "php": ">=7.4",
        "brain/monkey": "^2.6",
        "mockery/mockery": "^1.5",
        "yoast/phpunit-polyfills": "^2.0"
    },
    "require-dev": {
        "phpunit/phpunit": "^9.6",
        "yoast/wp-test-utils": "^1.2",
        "level-level/wp-browser-woocommerce": "^0.2"
    },
    "autoload": {
        "psr-4": {
            "WPDev\\WCCoreTest\\": "src/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "WPDev\\WCCoreTest\\Tests\\": "tests/"
        }
    },
    "config": {
        "allow-plugins": {
            "dealerdirect/phpcodesniffer-composer-installer": true
        }
    }
}
```

---

## 3. Audit of Antipatterns in Legacy WC Helpers

| Antipattern | Legacy Usage | Risk | v2.0 Solution |
|-------------|--------------|------|---------------|
| **`TRUNCATE TABLE`** | `Product::delete_all()`, `Order::truncate_orders()` | Implicit MySQL COMMIT breaks transaction rollback; cascading test failures | `DELETE FROM` with optional `WHERE` clause |
| **`update_post_meta()` on orders** | `Order::update_order_meta()` | Silently fails in HPOS mode; bypasses CRUD validation | `$order->update_meta_data()` + `$order->save()` |
| **`get_post_meta()` on orders** | `Order::get_order_meta()` | Returns wrong data in HPOS mode | `$order->get_meta()` |
| **Direct `$wpdb->insert('wp_posts')`** | `Product::create_simple_product()` | Bypasses CRUD hooks, caches, validation; breaks HPOS | `wc_get_product_object()` + `set_props()` + `save()` |
| **Static monolithic helpers** | `Product::create_simple_product()` | Cannot compose; cannot handle HPOS; hard to extend | Fluent Builders |
| **No hook restoration** | `tearDown()` only resets database | Hook side effects leak between tests | `restoreHooks()` in teardown |
| **Hardcoded table prefixes** | `"wp_woocommerce_order_items"` | Breaks in multisite / custom prefix environments | `$wpdb->prefix` |
| **Missing session initialization** | Tests call `WC()->cart` without `setUp()` init | `Call to a member function get() on null` | Explicit session/cart init in base test case |
| **No HPOS mode awareness** | Helpers assume CPT storage | Tests pass in CPT mode, fail in HPOS mode | `HposAwareTrait` with auto-detection |

---

## 4. Concrete Roadmap & API Spec for `wc-core-test` v2.0

### 4.1 Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **Phase 1: Foundation** | Weeks 1–4 | `AbstractBuilder`, `HposAwareTrait`, `SafeTeardownTrait`, PHP 7.4+ strict typing, PHPUnit 9.6 baseline |
| **Phase 2: Core Builders** | Weeks 5–8 | `ProductBuilder`, `OrderBuilder`, `CustomerBuilder`, `CouponBuilder` with full CRUD API usage |
| **Phase 3: Advanced Builders** | Weeks 9–12 | `ShippingZoneBuilder`, `TaxRateBuilder`, `FeeBuilder`, `CartBuilder`, `SessionBuilder` |
| **Phase 4: HPOS Integration** | Weeks 13–16 | Full HPOS ↔ CPT toggle support, data synchronization testing, migration test helpers |
| **Phase 5: Brain Monkey Layer** | Weeks 17–20 | `MockWooCommerce` facade, pre-built mocks for `WC_Product`, `WC_Order`, `WC_Cart`, `WC_Session` |
| **Phase 6: CI/CD Integration** | Weeks 21–24 | GitHub Actions workflows, QIT integration, PHP 7.4–8.3 matrix testing, code coverage reporting |

### 4.2 API Specification

```php
namespace WPDev\WCCoreTest;

// Product Builder
ProductBuilder::new()
    ->simple()
    ->withName('Test Product')
    ->withPrice(29.99)
    ->withSalePrice(19.99)
    ->withSku('TEST-001')
    ->withStock(100)
    ->withTaxStatus('taxable')
    ->inCategory('Test Category')
    ->create();

// Order Builder with HPOS awareness
OrderBuilder::new()
    ->withCustomer(UserBuilder::new()->create())
    ->withItems(2, ProductBuilder::new()->simple()->withPrice(50.00)->create())
    ->withShippingMethod('flat_rate', ['cost' => 10.00])
    ->withPaymentMethod('bacs')
    ->paid()
    ->withHposMode('auto')  // 'auto' | 'hpos' | 'cpt' | 'sync'
    ->create();

// Shipping Zone Builder
ShippingZoneBuilder::new()
    ->withName('US Zone')
    ->withLocation('US')
    ->withMethod('flat_rate', ['cost' => 5.00])
    ->create();

// Brain Monkey Mock Facade (for pure unit tests)
MockWooCommerce::product()
    ->withPrice(100.00)
    ->withSalePrice(80.00)
    ->mock();

MockWooCommerce::order()
    ->withStatus('completed')
    ->withTotal(100.00)
    ->mock();

// Test Case with automatic cleanup
class MyPluginTest extends WCCoreTestCase
{
    use HposAwareTrait;
    use SafeTeardownTrait;

    protected function tearDown(): void
    {
        $this->cleanupWooCommerceState();
        parent::tearDown();
    }

    public function test_order_creation(): void
    {
        $order = OrderBuilder::new()
            ->withCustomer(UserBuilder::new()->create())
            ->withItems(1, ProductBuilder::new()->simple()->withPrice(50.00)->create())
            ->paid()
            ->create();

        $this->assertEquals('processing', $order->get_status());
        $this->assertEquals(50.00, $order->get_total());
    }
}
```

### 4.3 CI/CD Pipeline Specification

```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]
jobs:
  unit:
    name: Unit Tests (PHP ${{ matrix.php }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        php: ['7.4', '8.0', '8.1', '8.2', '8.3']
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php }}
          extensions: mysqli
      - run: composer install --prefer-dist --no-progress
      - run: vendor/bin/phpunit --testsuite=unit --coverage-clover=coverage.xml
  
  integration:
    name: Integration Tests (WC ${{ matrix.wc }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        wc: ['8.5', '9.0', '9.5']
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: wordpress_test
    steps:
      - uses: actions/checkout@v4
      - run: composer install --prefer-dist
      - run: vendor/bin/phpunit --testsuite=integration
```

---

## Conclusion

The `wc-core-test` v2.0 architecture must resolve the fundamental mismatch between WooCommerce core's sophisticated internal testing infrastructure and the ecosystem's lack of consumable, modern testing tools. By adopting **Fluent Builders** over static helpers, **HPOS-aware data store routing** over CPT assumptions, **`DELETE FROM` over `TRUNCATE`**, **Brain Monkey for pure unit tests** alongside **wp-browser for integration tests**, and **strict typing with PHP 7.4–8.3 + PHPUnit 9.6 compatibility**, the library can position itself as the definitive testing framework for modern WooCommerce plugin development—decoupled from the monorepo, but no less rigorous.