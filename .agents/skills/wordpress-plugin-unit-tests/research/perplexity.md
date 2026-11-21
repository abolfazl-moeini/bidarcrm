# Executive Summary & Ecosystem Reality Check

`wpdev/wc-core-test` should evolve from a legacy collection of static convenience helpers into a **layered test-support toolkit**: pure-PHP builders and test doubles for fast unit tests; WooCommerce-aware integration builders for real persistence; and explicit HPOS/CPT execution modes for storage-compatibility coverage.

The central architectural rule is simple: **test behavior through WooCommerce’s public CRUD, query, service, and Store API boundaries—not through `wp_posts`, `postmeta`, or hand-written assumptions about where order data lives.** HPOS makes this non-negotiable for anything involving orders, refunds, order meta, addresses, notes, and queries. WooCommerce’s own compatibility guidance likewise directs extensions to use `wc_get_order()`, CRUD methods such as `update_meta_data()` followed by `save()`, and WooCommerce order-query APIs instead of `WP_Query`, `get_posts()`, or direct post-meta calls. [developer.woocommerce](https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/)

A practical v2.0 should therefore have three distinct layers:

| Layer | Purpose | WordPress/MySQL required? | Typical speed |
|---|---|---:|---:|
| `wc-core-test/unit` | Domain-level unit tests, mocks, collaborators, value objects | No | Milliseconds |
| `wc-core-test/integration` | WC CRUD builders, real products/orders/coupons, HPOS matrix | Yes | Seconds |
| `wc-core-test/e2e` adapters | Optional QIT / Playwright setup data and assertions | Docker/site | Minutes |

Do **not** attempt to make one factory work equally well in all three contexts. A factory that persists `WC_Product` and `WC_Order` objects necessarily belongs to integration testing; a pure unit test should instead receive interfaces, DTOs, mocked `WC_Order` objects, or narrowly defined WooCommerce gateway adapters.

WooCommerce core itself is now a large monorepo with PHP, TypeScript, Playwright-based end-to-end/API testing, and a PHP test suite; its current developer documentation recommends `wp-env` for local test setup, PHP tests for the core suite, and Playwright for E2E/API coverage.  Marketplace-side quality validation is increasingly represented by QIT, which offers activation, security, compatibility, static-analysis, API, and Playwright-oriented test capabilities in disposable CI environments. [developer.woocommerce](https://developer.woocommerce.com/docs/contribution/testing/)

## Pillar 1: Core Internals and Fixture Ladders

### 1. HPOS, CPT, and the purpose of storage-mode tests

HPOS changes the authoritative persistence model for WooCommerce orders. Under classic storage, orders are WordPress posts and much associated data lives in `wp_postmeta`; under HPOS, orders are persisted in WooCommerce custom order tables, while WooCommerce’s data-store layer chooses the active backend. The same extension code should remain correct in either mode when it uses CRUD and supported query APIs. [developer.woocommerce](https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/)

In current WooCommerce core test code, the concepts commonly named **`HposTestCase`** and **`HPOSToggleTrait`** exist to make tests deliberate about the storage engine rather than accidentally running only against whichever backend happened to be configured.

The names should be treated as **internal core-suite utilities, not a stable third-party API contract**. Exact namespaces, base-class relationships, helper signatures, and lifecycle behavior can change as the WooCommerce monorepo evolves. This matters because core’s own recent issue tracker includes an HPOS-state leak report: an “HPOS-off” PHPUnit job was apparently not actually executing with HPOS disabled, illustrating that global feature state must be restored rigorously between tests. [github](https://github.com/woocommerce/woocommerce/issues/68358)

Conceptually:

- `HposTestCase` is an integration-oriented test-case abstraction for tests whose correctness depends on order data storage. It provides or coordinates a valid WooCommerce test environment and makes storage-mode setup part of the test lifecycle.
- `HPOSToggleTrait` is the lower-level mechanism that enables/disables the HPOS/custom-order-tables feature state, typically preserving prior state and restoring it afterward.
- The important behavior is not the class name. The important behavior is:
  1. Capture the original feature configuration.
  2. Toggle HPOS before creating fixtures.
  3. Clear data-store/object caches if needed.
  4. Execute the test under a single known mode.
  5. Restore the original setting, including synchronization-related state.
  6. Never let one test’s mode leak to another.

For `wc-core-test` v2.0, expose a stable package-owned abstraction rather than making consumers import WooCommerce internals:

```php
<?php
declare(strict_types=1);

namespace WpDev\WcCoreTest\Integration\Storage;

final class OrderStorageMode {
    public const CPT  = 'cpt';
    public const HPOS = 'hpos';

    private function __construct() {}
}
```

```php
<?php
declare(strict_types=1);

namespace WpDev\WcCoreTest\Integration\PHPUnit;

trait RunsWithOrderStorageModes {
    /**
     * @dataProvider orderStorageModes
     */
    public function test_example_is_storage_agnostic(string $storage_mode): void {
        $this->setOrderStorageMode($storage_mode);

        $order = OrderBuilder::new()
            ->withStatus('processing')
            ->withMeta('_my_plugin_reference', 'ABC-123')
            ->create();

        $reloaded = wc_get_order($order->get_id());

        self::assertSame(
            'ABC-123',
            $reloaded->get_meta('_my_plugin_reference', true)
        );
    }

    public function orderStorageModes(): array {
        return [
            'classic CPT store' => [ OrderStorageMode::CPT ],
            'HPOS store'        => [ OrderStorageMode::HPOS ],
        ];
    }

    abstract protected function setOrderStorageMode(string $mode): void;
}
```

The test must create its order **after** the mode changes. Creating an order in CPT mode and then switching to HPOS does not establish meaningful HPOS coverage; it mostly tests synchronization and may produce false confidence.

### 2. A modern fixture ladder

A fixture ladder means selecting the **lowest-cost fixture that faithfully reaches the behavior under test**. It is not merely an optimization. It prevents tests from accidentally depending on irrelevant hooks, taxes, sessions, shipping logic, order recalculation, lookup-table updates, or persistence side effects.

Use this hierarchy:

| Fixture level | Example | Use when | Avoid when |
|---|---|---|---|
| 0 — Value object / DTO | `new Money('19.99', 'USD')` | Formatting, calculations, mapping, validation | Testing WC persistence or hooks |
| 1 — Mock / fake | Mock `WC_Order`, fake repository | One class’s decisions or collaborator interaction | Verifying Woo CRUD behavior |
| 2 — Unsaved WC object | `new WC_Order()` or `new WC_Product_Simple()` | Object-level logic without save/query behavior | Need IDs, data stores, hooks, persistence |
| 3 — Minimal persisted CRUD entity | `wc_create_order()`, `$product->save()` | Metadata, statuses, CRUD hydration, custom data-store behavior | You need checkout totals/taxes/session semantics |
| 4 — Fully assembled domain fixture | Order with customer, line items, shipping, coupon, payment | Plugin behavior truly relies on those facts | Testing a simple meta read or predicate |
| 5 — Boundary-table seed | Direct insert into a dedicated plugin-owned table | Migration, corruption recovery, legacy-data compatibility, exact SQL edge cases | Normal order/product fixture creation |
| 6 — HTTP / checkout / Store API / browser | REST or Store API request, Playwright checkout | Contract, serialization, Blocks integration, browser behavior | Internal service logic |

Examples:

```php
// Level 2: unsaved object; no database needed once WC classes are loaded.
$product = new \WC_Product_Simple();
$product->set_regular_price('10.00');

self::assertSame('10.00', $product->get_regular_price());
```

```php
// Level 3: minimal persisted order.
$order = wc_create_order();
$order->set_status('pending');
$order->update_meta_data('_my_extension_marker', 'marker-1');
$order->save();
```

```php
// Level 4: use only when the production behavior depends on totals/items/payment.
$order = OrderBuilder::new()
    ->withCustomer($customer)
    ->withLineItem($product, 2)
    ->withShippingMethod('flat_rate:1', 'Flat rate', '8.00')
    ->withCoupon($coupon)
    ->withPaymentMethod('test_gateway', 'Test Gateway')
    ->calculateTotals()
    ->create();
```

```php
// Level 5: valid only for a plugin-owned table or a deliberate data-store boundary test.
global $wpdb;

$wpdb->insert(
    $wpdb->prefix . 'my_plugin_events',
    [
        'order_id'   => $order_id,
        'event_type' => 'legacy_import',
        'payload'    => wp_json_encode(['version' => 1]),
    ],
    ['%d', '%s', '%s']
);
```

The key restriction: direct SQL must **not** be the default fixture mechanism for WooCommerce orders, products, coupons, refunds, or order meta. The test helper should not turn a private WooCommerce schema into a de facto public API.

### 3. Core-style lifecycle helpers worth emulating

Core contains several useful helper patterns, including names such as `MetaDataAssertionTrait`, `LoggerSpyTrait`, and `SerializingCacheTrait`. Even where a core trait is internal or moves over time, the behavior is worth adopting as a stable, package-owned equivalent.

| Pattern | What it should provide in v2.0 | Why it matters |
|---|---|---|
| Metadata assertions | Canonical assertions against `WC_Data` metadata | Prevents raw-table assumptions and improves failure messages |
| Logger spy | A temporary logger capture with reset/restore lifecycle | Lets tests assert observability without reading log files |
| Serializing cache | Cache fake that models serialization boundaries | Detects hidden assumptions that cached values remain object-identical |
| Hook-state guard | Snapshot/restore selected hooks, filters, and globals | Prevents cross-test pollution |
| Feature-state guard | Snapshot/restore HPOS and feature configuration | Makes HPOS matrix execution trustworthy |
| Clock guard | Injectable time source or temporary WordPress-time seam | Avoids brittle date assertions |
| Option guard | Tracks changed options and restores/deletes them | Essential for Woo settings/features |
| Session/cart guard | Explicit WC session/cart setup and teardown | Prevents null-session failures |

Suggested metadata trait:

```php
<?php
declare(strict_types=1);

namespace WpDev\WcCoreTest\Integration\Assertions;

trait MetadataAssertions {
    protected function assertWcMetaSame(
        \WC_Data $object,
        string $key,
        $expected,
        string $message = ''
    ): void {
        self::assertSame(
            $expected,
            $object->get_meta($key, true),
            $message ?: sprintf(
                'Meta key "%s" did not match for %s #%s.',
                $key,
                get_class($object),
                (string) $object->get_id()
            )
        );
    }

    protected function assertWcMetaMissing(
        \WC_Data $object,
        string $key,
        string $message = ''
    ): void {
        self::assertSame('', $object->get_meta($key, true), $message);
    }
}
```

Suggested logger spy design:

```php
<?php
declare(strict_types=1);

interface LogSink {
    public function record(string $level, string $message, array $context = []): void;
}

final class InMemoryLogSink implements LogSink {
    private array $entries = [];

    public function record(string $level, string $message, array $context = []): void {
        $this->entries[] = compact('level', 'message', 'context');
    }

    public function entries(): array {
        return $this->entries;
    }
}
```

Prefer injecting a plugin-owned logger adapter into your services. Falling back to replacing WooCommerce’s global logger should be restricted to integration tests because globals create more cleanup work and test ordering risks.

### 4. Core and WordPress transaction reality

WordPress’s PHPUnit environment wraps individual tests in MySQL transactions and rolls those transactions back at the end of each test. That design gives fast cleanup for ordinary DML such as fixture inserts, updates, and deletes. [make.wordpress](https://make.wordpress.org/core/handbook/testing/automated-testing/writing-phpunit-tests/)

`TRUNCATE TABLE` is dangerous in this context because MySQL treats it as DDL and performs implicit commits. Once the transaction has been committed, the test harness cannot roll it back. Data survives into later tests and can corrupt the suite in order-dependent ways. WordPress’s own testing documentation specifically cautions that tests rely on transaction rollback and points developers to statements that trigger commits. [make.wordpress](https://make.wordpress.org/core/handbook/testing/automated-testing/writing-phpunit-tests/)

Use this instead:

```php
global $wpdb;

$table = $wpdb->prefix . 'my_plugin_events';
$wpdb->query("DELETE FROM `{$table}`");
```

But use it carefully:

- Use `DELETE` only for tables your plugin owns or for narrowly scoped records created by the test.
- Do not issue broad deletes against WooCommerce tables in ordinary tests.
- Prefer tracking created IDs and deleting only those rows when a rollback is unavailable.
- Do not use `ALTER TABLE`, `DROP TABLE`, `CREATE TABLE`, `RENAME TABLE`, or `TRUNCATE TABLE` in a rollback-dependent test without an explicitly designed database-isolation strategy.
- Treat object cache, transients, options, scheduler queues, hooks, and static singletons as separate state domains; transaction rollback does not reset them.

## Pillar 2: Extension and Commercial Testing Patterns

### 1. What mature extension teams generally do

There is no universal public testing stack shared identically by Automattic, Woo marketplace vendors, YITH, Barn2, WP Desk, or Level Level. Commercial plugin repositories are often private, and public evidence should not be overstated as proof of their internal practices.

However, the ecosystem converges on a recognizable split:

- **Pure unit tests** for business rules, mapping, validation, eligibility logic, pricing modifiers, API-client behavior, and WordPress/WooCommerce boundary adapters.
- **WordPress/WooCommerce integration tests** for persistence, hooks, data-store behavior, scheduled actions, settings, REST contracts, and compatibility paths.
- **Browser/API acceptance coverage** for checkout, payment lifecycle, Store API/Blocks behavior, and admin workflows.
- **Static analysis and compatibility matrices** for PHP/WordPress/WooCommerce versions.
- **Disposable CI environments** rather than reliance on a developer’s local long-lived WordPress installation.

For WooCommerce Marketplace developers, QIT is the official direction of travel. WooCommerce describes QIT as a testing platform with managed tests that include E2E, activation, security scanning, PHPStan analysis, API testing, and more; it can run custom Playwright tests and integrate with CI/GitHub Actions.  QIT’s public documentation describes sandboxed Alpine-based Docker environments, a single CLI workflow, standardized Playwright E2E support, cross-plugin compatibility runs, and the same test commands locally and in CI. [developer.woocommerce](https://developer.woocommerce.com/docs/extensions/getting-started-extensions/)

This does **not** replace PHPUnit. It complements PHPUnit by testing the extension as installed software in a real WordPress/WooCommerce environment.

### 2. Available packages and their appropriate roles

| Package/tool | Current role | Good fit for `wc-core-test`? | Important limitation |
|---|---|---|---|
| `level-level/wp-browser-woocommerce` | Adds WooCommerce factories for wp-browser integration tests | Useful reference/development dependency for Codeception/wp-browser consumers | Not a universal PHPUnit/HPOS abstraction |
| `woocommerce/qit-cli` | Managed extension-quality and CI platform | Recommended optional CI/E2E lane | Not a PHP fixture library |
| `humanmade/woocommerce-demo-generator` | WP-CLI demo data generator using Faker | Useful for manual, demo, load, or E2E setup | Not deterministic PHPUnit fixture infrastructure |
| Brain Monkey + Mockery | Isolated PHP/WordPress function and object mocking | Strong unit-test companion package | Cannot prove WC data-store correctness |
| WP test suite / `wp-tests-lib` | Real WordPress + DB integration harness | Required integration foundation | Heavier and stateful |
| WooCommerce core test utilities | Useful implementation reference | Copy concepts, not internal imports | No stable standalone public contract |

`level-level/wp-browser-woocommerce` is published on Packagist and explicitly provides factory functions/unit-test factories for WooCommerce theme and plugin integration testing through wp-browser. Its repository indicates activity through late 2024.  It is valuable as a reference and may be appropriate for teams already committed to Codeception/wp-browser, but it should not dictate the architecture of a PHPUnit-first general-purpose library. [github](https://github.com/level-level/wp-browser-woocommerce)

`humanmade/woocommerce-demo-generator` is a lightweight WP-CLI generator for demo products and orders using Faker. That makes it useful for generating realistic environments, not for deterministic test fixtures where exact totals, state, and cleanup need to be controlled. [packagist](https://packagist.org/packages/humanmade/woocommerce-demo-generator)

`woocommerce/qit-cli` is a testing/orchestration tool, not a fixture factory. QIT can be installed via Composer globally, run commands such as security, PHP compatibility, malware, and Woo E2E checks, and requires WooCommerce partner authentication for Marketplace extension workflows. [qit.woo](https://qit.woo.com/docs/)

### 3. Why there is no standalone `woocommerce/test-framework`

WooCommerce has not established a stable, decoupled, universally supported Composer package named `woocommerce/test-framework`. The absence is understandable:

1. **Core test utilities are tightly coupled to core internals.**  
   They may depend on WooCommerce bootstrap order, the dependency-injection container, feature flags, package paths, database schema, test bootstrap code, and internals that are intentionally not extension APIs.

2. **The version matrix is difficult.**  
   A shared package must work across multiple WordPress versions, WooCommerce versions, PHP versions, PHPUnit major versions, MySQL/MariaDB variants, feature flags, and HPOS migration states.

3. **A test framework becomes a public compatibility contract.**  
   Exposing core test helpers separately would require semantic-versioning guarantees, deprecation paths, documentation, support, and security maintenance for code that core currently changes to serve its own monorepo.

4. **Different layers have incompatible needs.**  
   Unit tests need no WordPress; integration tests need WordPress + a database; Blocks/Store API tests often need HTTP/browser orchestration. One package cannot cleanly conceal those different execution models without becoming broad and brittle.

5. **WooCommerce’s ecosystem strategy increasingly uses tooling rather than shared fixtures.**  
   Core documents `wp-env` for local testing and Playwright for E2E/API tests, while Marketplace quality is moving through QIT-managed environments. [developer.woocommerce](https://developer.woocommerce.com/docs/contribution/testing/)

### 4. Clean workarounds used in modern CI

The best workaround is **explicit composition**, not importing WooCommerce’s private test bootstrap:

```text
Your plugin
├── src/
├── tests/
│   ├── Unit/
│   ├── Integration/
│   ├── Contract/
│   └── E2E/
├── composer.json
├── phpunit.unit.xml.dist
├── phpunit.integration.xml.dist
└── .github/workflows/
```

- `tests/Unit`: PHPUnit + Mockery + Brain Monkey, no WordPress database.
- `tests/Integration`: WordPress test suite + WooCommerce plugin bootstrap + MySQL.
- `tests/Contract`: REST/Store API requests against a booted app.
- `tests/E2E`: QIT and/or Playwright.
- Test matrices run separate jobs for PHP, WordPress/WooCommerce support boundaries, and HPOS mode.
- Keep all WooCommerce version-specific bootstrapping in a small application-level bootstrap package or local test bootstrap, not in your production package.

## Pillar 3: The Hybrid Testing Model

### 1. The right boundary for pure unit tests

Brain Monkey is purpose-built for mocking PHP functions and provides WordPress-specific helpers; it depends on Mockery and Patchwork.  It is appropriate when the code’s correctness can be established without loading WordPress, WooCommerce, a database, or real WooCommerce data stores. [github](https://github.com/Brain-WP/BrainMonkey)

Use pure unit tests for:

- Deterministic business rules: discount eligibility, fee calculation policy, status-transition decisions, mapping, validation, formatting.
- Conversion between plugin DTOs and external API payloads.
- Decision logic that calls `wc_get_order()`, `wc_get_product()`, `wc_price()`, `get_option()`, filters, actions, or similar boundaries.
- Hook-registration tests.
- Error handling and logging decisions.
- Repository/service interactions where you only need to verify a method was called with the expected arguments.
- Serialization/parsing of a plugin’s own data.

Use integration tests for:

- `WC_Order`, `WC_Product`, `WC_Coupon`, refund, tax, shipping, payment, and metadata persistence.
- Any behavior involving `save()`, data stores, order lookup tables, or reload/hydration.
- HPOS/CPT compatibility.
- WooCommerce query behavior, including `wc_get_orders()` or `WC_Order_Query`.
- WordPress options, users, terms, hooks that must really run, scheduled actions, webhooks, email integration, REST registration.
- Cart/session/checkout lifecycle.
- Store API and Blocks behavior.
- Recalculation of order totals, tax logic, coupons, stock reduction, payment completion, or status side effects.

A reliable heuristic:

> If a test assertion says “the database contains,” “the order can be reloaded,” “this works under HPOS,” “the Store API returns,” or “checkout behaves,” it is not a pure unit test.

### 2. Design production code to make tests easy

Do not let domain services call global WooCommerce functions everywhere. Put global boundaries behind tiny interfaces:

```php
<?php
declare(strict_types=1);

namespace MyPlugin\Woo;

interface OrderProvider {
    public function find(int $order_id): ?\WC_Order;
}
```

```php
<?php
declare(strict_types=1);

namespace MyPlugin\Woo;

final class NativeOrderProvider implements OrderProvider {
    public function find(int $order_id): ?\WC_Order {
        $order = wc_get_order($order_id);

        return $order instanceof \WC_Order ? $order : null;
    }
}
```

```php
<?php
declare(strict_types=1);

namespace MyPlugin\Domain;

final class CanCapturePayment {
    public function forOrder(\WC_Order $order): bool {
        return $order->has_status('on-hold')
            && $order->get_total() > 0.0
            && ! $order->is_paid();
    }
}
```

Now the domain service is easy to unit test with Mockery:

```php
<?php
declare(strict_types=1);

use Mockery;
use PHPUnit\Framework\TestCase;

final class CanCapturePaymentTest extends TestCase {
    use \Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;

    public function test_it_allows_an_unpaid_positive_on_hold_order(): void {
        $order = Mockery::mock(\WC_Order::class);
        $order->shouldReceive('has_status')->once()->with('on-hold')->andReturn(true);
        $order->shouldReceive('get_total')->once()->andReturn(49.95);
        $order->shouldReceive('is_paid')->once()->andReturn(false);

        self::assertTrue((new \MyPlugin\Domain\CanCapturePayment())->forOrder($order));
    }
}
```

If the class itself calls a global function, isolate that function call in an adapter. If refactoring is temporarily impossible, Brain Monkey can patch/mock it:

```php
<?php
declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

final class OrderLookupServiceTest extends TestCase {
    use MockeryPHPUnitIntegration;

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
    }

    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }

    public function test_it_returns_false_when_no_order_exists(): void {
        Functions\when('wc_get_order')->justReturn(false);

        self::assertFalse(
            (new \MyPlugin\Woo\OrderLookupService())->hasOrder(123)
        );
    }
}
```

The Brain Monkey lifecycle is important: initialize it for each test and tear it down afterward. This avoids mock/function state leaking across tests. Brain Monkey is specifically intended to enable function mocking and WordPress-specific isolated tests without booting the full platform. [github](https://github.com/Brain-WP/BrainMonkey)

### 3. Mocking WooCommerce safely

Mock WooCommerce classes only at your architectural boundary.

Good:

```php
$order = Mockery::mock(\WC_Order::class);
$order->shouldReceive('get_currency')->andReturn('USD');
$order->shouldReceive('get_total')->andReturn('99.95');
```

Risky:

```php
// Fragile: the test now duplicates WooCommerce implementation behavior.
$order->shouldReceive('calculate_totals')
    ->andReturnUsing(function () {
        // Reimplement cart/order totals here.
    });
```

Never claim a mocked `WC_Order` test proves:

- HPOS support;
- a `save()` writes to the intended data store;
- totals are calculated correctly;
- order items persist;
- lookup tables are updated;
- coupons or tax rates apply correctly;
- Store API / Blocks checkout works.

Those claims require integration or E2E coverage.

### 4. Sessions, carts, and notices: avoiding null failures

The common error:

```text
Call to a member function get() on null
```

usually means production code assumed that `WC()->session`, `WC()->cart`, `WC()->customer`, or an initialized notices/session context exists. In a CLI PHPUnit process, none of those are guaranteed merely because WooCommerce classes are autoloadable.

The preferred solution is architectural:

- Keep session/cart/notices out of domain services.
- Pass required inputs explicitly.
- Introduce a `CartContext`, `NoticeBus`, or `CheckoutContext` interface.
- Test those services with fakes in unit tests.
- Test the actual Woo integration in a smaller integration suite.

Example:

```php
<?php
declare(strict_types=1);

interface NoticeBus {
    public function error(string $message): void;
}

final class CheckoutEligibilityService {
    private NoticeBus $notices;

    public function __construct(NoticeBus $notices) {
        $this->notices = $notices;
    }

    public function validate(bool $eligible): bool {
        if ($eligible) {
            return true;
        }

        $this->notices->error('This payment method is not available.');
        return false;
    }
}
```

A Woo adapter can call `wc_add_notice()`, but the unit test should test the domain rule with an in-memory fake.

When an integration test truly needs WC session/cart state, make setup explicit and centralize version-specific bootstrapping:

```php
<?php
declare(strict_types=1);

trait BootsWooCommerceCustomerContext {
    protected function bootWooCustomerContext(?int $user_id = null): void {
        WC()->initialize_session();
        WC()->initialize_cart();

        if ($user_id !== null) {
            wp_set_current_user($user_id);
            WC()->customer = new \WC_Customer($user_id, true);
        }

        wc_clear_notices();
        WC()->cart->empty_cart();
    }

    protected function cleanWooCustomerContext(): void {
        wc_clear_notices();

        if (WC()->cart) {
            WC()->cart->empty_cart();
        }

        wp_set_current_user(0);
    }
}
```

Treat the sample above as a pattern rather than a universal drop-in, because the exact bootstrap sequence depends on the WooCommerce/WordPress test environment. The API surface should live behind one package method such as `WooContext::bootCart()` so callers never duplicate fragile initialization code.

Tests that only verify “an error notice is requested” should not boot a real cart or session. Tests that verify “the customer sees a notice in Blocks checkout” should be API/E2E tests, not PHPUnit unit tests.

## Pillar 4: Recommended `wc-core-test` v2.0 Architecture

### 1. Proposed package topology

Use optional Composer packages or clearly separated namespaces so production consumers do not install PHPUnit/WP test dependencies unnecessarily.

```text
wpdev/wc-core-test
├── src/
│   ├── Contracts/
│   ├── Support/
│   └── Unit/
├── integration/
│   ├── Builders/
│   ├── Assertions/
│   ├── Cleanup/
│   ├── Context/
│   ├── Fixtures/
│   ├── Storage/
│   └── PHPUnit/
├── tests/
├── composer.json
└── README.md
```

Recommended package split:

| Package | Depends on | Exports |
|---|---|---|
| `wpdev/wc-core-test` | PHP only | Test doubles, clocks, IDs, pure builders, shared assertions |
| `wpdev/wc-core-test-phpunit` | PHPUnit / polyfills | Base unit case, Mockery/Brain Monkey bridge, assertions |
| `wpdev/wc-core-test-wp` | WP test suite + WooCommerce | CRUD builders, cleanup traits, HPOS matrix runner |
| `wpdev/wc-core-test-qit` | QIT configuration/templates | Optional CI and E2E setup helpers |

If maintaining multiple packages is initially too costly, ship one package but use Composer `suggest` entries and avoid autoloading integration classes unless WordPress/WooCommerce is available.

### 2. Builder-based API specification

Static helpers are convenient but do not express intent well, hide defaults, and tend to accumulate parameter lists that become incompatible with modern WooCommerce behavior.

Keep a small backwards-compatible facade in v2.0, but mark it deprecated:

```php
final class Product {
    /** @deprecated Use ProductBuilder::simple()->create(). */
    public static function create_simple_product(array $args = []): \WC_Product {
        return ProductBuilder::simple()->withProperties($args)->create();
    }
}
```

New API:

```php
$product = ProductBuilder::simple()
    ->named('Blue Hoodie')
    ->sku('hoodie-blue')
    ->regularPrice('40.00')
    ->salePrice('30.00')
    ->manageStock(12)
    ->inCategory($category)
    ->create();
```

```php
$order = OrderBuilder::new()
    ->withCustomer($customer)
    ->withBillingAddress([
        'first_name' => 'Abolfazl',
        'last_name'  => 'Moeini',
        'country'    => 'US',
        'state'      => 'TX',
        'city'       => 'Dallas',
        'postcode'   => '75201',
    ])
    ->withLineItem($product, 2)
    ->withShippingMethod('flat_rate:1', 'Flat rate', '9.99')
    ->withFee('Handling', '2.50', taxable: false)
    ->withCoupon($coupon)
    ->withPaymentMethod('bacs', 'Direct bank transfer')
    ->withStatus('on-hold')
    ->calculateTotals()
    ->create();
```

```php
$paidOrder = OrderBuilder::new()
    ->withLineItem($product, 1)
    ->withPaymentMethod('test_gateway', 'Test Gateway')
    ->calculateTotals()
    ->paid('txn_test_123')
    ->create();
```

Avoid one ambiguous method such as `withItems(2)`. It hides what “2” means: two units of one product, two distinct products, random products, products at what price, taxable or not? Prefer explicit API calls:

```php
->withLineItem($product, 2)
->withRandomSimpleProducts(2) // only in a clearly named convenience fixture API
```

A builder should have immutable or clone-on-write behavior when practical, but PHP 7.4 compatibility makes readonly properties unavailable. A pragmatic implementation can remain mutable while documenting that a builder instance is single-use.

Suggested core interfaces:

```php
<?php
declare(strict_types=1);

namespace WpDev\WcCoreTest\Integration\Builders;

interface PersistsFixture {
    /**
     * @return object
     */
    public function create();
}

interface ConfiguresStorageMode {
    public function inStorageMode(string $mode): self;
}
```

```php
<?php
declare(strict_types=1);

final class OrderBuilder implements PersistsFixture {
    private ?int $customer_id = null;
    private array $items = [];
    private array $meta = [];
    private ?string $status = null;
    private ?string $storage_mode = null;
    private bool $should_calculate_totals = false;
    private ?array $paid_transaction = null;

    public static function new(): self {
        return new self();
    }

    public function withCustomer(\WP_User $customer): self {
        $this->customer_id = (int) $customer->ID;
        return $this;
    }

    public function withLineItem(\WC_Product $product, int $quantity = 1): self {
        if ($quantity < 1) {
            throw new \InvalidArgumentException('Quantity must be at least one.');
        }

        $this->items[] = [$product, $quantity];
        return $this;
    }

    public function withMeta(string $key, $value): self {
        $this->meta[$key] = $value;
        return $this;
    }

    public function withStatus(string $status): self {
        $this->status = $status;
        return $this;
    }

    public function calculateTotals(): self {
        $this->should_calculate_totals = true;
        return $this;
    }

    public function paid(string $transaction_id = ''): self {
        $this->paid_transaction = ['transaction_id' => $transaction_id];
        return $this;
    }

    public function inStorageMode(string $mode): self {
        $this->storage_mode = $mode;
        return $this;
    }

    public function create(): \WC_Order {
        // Delegate mode management to a scoped storage-mode guard.
        // Create through Woo CRUD only.
        $order = wc_create_order();

        if ($this->customer_id !== null) {
            $order->set_customer_id($this->customer_id);
        }

        foreach ($this->items as [$product, $quantity]) {
            $order->add_product($product, $quantity);
        }

        foreach ($this->meta as $key => $value) {
            $order->update_meta_data($key, $value);
        }

        if ($this->status !== null) {
            $order->set_status($this->status);
        }

        if ($this->should_calculate_totals) {
            $order->calculate_totals();
        }

        $order->save();

        if ($this->paid_transaction !== null) {
            $order->payment_complete($this->paid_transaction['transaction_id']);
        }

        return $order;
    }
}
```

In production implementation, do not leave the storage-mode parameter as a hidden global behavior. Either:

- require callers to select a mode through a test trait/base class; or
- execute the builder inside `withStorageMode($mode, callable $callback)`.

The second option makes scope visible:

```php
$this->withOrderStorageMode(OrderStorageMode::HPOS, function (): void {
    $order = OrderBuilder::new()
        ->withLineItem($product, 1)
        ->create();

    self::assertSame('pending', $order->get_status());
});
```

### 3. HPOS compatibility API

Expose a small, intentional surface:

```php
interface OrderStorageController {
    public function currentMode(): string;

    public function activate(string $mode): void;

    public function restore(): void;

    /**
     * @template T
     * @param callable():T $callback
     * @return T
     */
    public function within(string $mode, callable $callback);
}
```

Required behavior:

- Validate mode is either CPT or HPOS.
- Record original feature state only once per scope.
- Activate the requested data-store mode before fixture creation.
- Clear package-owned caches and refresh the Woo layer as required.
- Restore original state in `finally`, even if assertions fail.
- Fail loudly if synchronization/feature conditions make the requested mode invalid.
- Never silently fall back from HPOS to CPT.

Your test suite should have both:

1. **Parameterized feature tests** for functionality that claims HPOS support.
2. **One or two focused storage-boundary tests** that prove the real persistence/query path under both modes.

Do not double every test automatically. That creates slow, noisy suites. Run the storage matrix only for behavior that touches orders, refunds, order meta, order query behavior, or direct integration with data stores.

Extensions should also declare their HPOS compatibility in their main plugin file using WooCommerce’s `FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true )` when it is truthful. [developer.woocommerce](https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/)

### 4. Cleanup and isolation design

Provide guards that make cleanup automatic:

```php
trait CleansWooTestState {
    private array $created_option_keys = [];
    private array $created_zone_ids = [];
    private array $created_tax_rate_ids = [];
    private array $created_fee_ids = [];

    protected function rememberOption(string $key): void {
        $this->created_option_keys[] = $key;
    }

    protected function tearDown(): void {
        try {
            $this->cleanupWooState();
        } finally {
            parent::tearDown();
        }
    }

    private function cleanupWooState(): void {
        foreach ($this->created_option_keys as $key) {
            delete_option($key);
        }

        wc_clear_notices();

        if (function_exists('WC') && WC()->cart) {
            WC()->cart->empty_cart();
        }

        // Restore filters/hooks, storage flags, cache spies, clock overrides.
        // Delete only IDs created by this test where transaction rollback is absent.
    }
}
```

Use registries, not sweeping cleanup:

```php
$zone = ShippingZoneBuilder::new()->named('Dallas')->create();
$this->resources()->trackShippingZone($zone->get_id());

$rate_id = TaxRateBuilder::new()
    ->country('US')
    ->state('TX')
    ->rate('8.2500')
    ->create();
$this->resources()->trackTaxRate($rate_id);
```

Then teardown removes precisely those resources. This is safer than “delete all shipping zones” or “truncate every tax table,” especially in shared local or CI databases.

State categories to guard:

| State category | Cleanup strategy |
|---|---|
| Database rows | Let transactions roll back; otherwise delete tracked IDs |
| Plugin options | Snapshot and restore/delete touched keys |
| Woo feature flags | Scoped controller with `try/finally` restoration |
| Object cache/transients | Use unique keys; delete tracked keys |
| WP hooks | Register through a tracker or explicitly remove filters/actions |
| Current user | Reset via `wp_set_current_user(0)` |
| WC session/cart | Explicit boot and clear |
| Notices | `wc_clear_notices()` in integration context |
| Scheduled actions | Use unique group/args; unschedule tracked actions |
| Files/uploads | Use temporary paths and remove them in teardown |
| Static/singleton state | Provide reset adapters; never assume DB rollback resets it |

### 5. PHP, PHPUnit, and tooling policy

WooCommerce’s repository currently lists PHP 7.4+ as a prerequisite, so PHP 7.4 remains a reasonable lower bound if alignment with WooCommerce is a priority.  But PHP 7.4 reached end of life in 2022, so this should be a **compatibility floor**, not the primary CI target. [github](https://github.com/woocommerce/woocommerce)

Recommended support policy:

| Concern | Recommendation |
|---|---|
| PHP | Support PHP 7.4–8.3 initially; test 7.4 separately and keep it conservative |
| PHP syntax | `declare(strict_types=1);`, typed properties, scalar/return types; avoid enums, readonly, union types, attributes, constructor property promotion if 7.4 support is required |
| PHPUnit | Build against PHPUnit 9.6 as the common baseline; use polyfills/adapters to absorb assertion/lifecycle differences |
| Polyfills | Consider `yoast/phpunit-polyfills` for cross-version support where required |
| Mocking | `mockery/mockery` for object collaboration; Brain Monkey only in the unit-test package |
| Static analysis | PHPStan with WordPress/WooCommerce-aware stubs; baseline only temporarily |
| Coding standards | WPCS + WooCommerce sniffs where appropriate; WooCommerce publishes `woocommerce/woocommerce-sniffs`.  [github](https://github.com/woocommerce/woocommerce-sniffs) |
| Integration bootstrap | Pin/verify supported WordPress + WooCommerce combinations; never rely on an unversioned global checkout |
| CI | Separate fast unit, integration, HPOS matrix, static analysis, and QIT/E2E jobs |

A PHP 7.4-safe class declaration:

```php
<?php
declare(strict_types=1);

namespace WpDev\WcCoreTest\Support;

final class TestClock {
    /** @var \DateTimeImmutable */
    private $now;

    public function __construct(\DateTimeImmutable $now) {
        $this->now = $now;
    }

    public function now(): \DateTimeImmutable {
        return $this->now;
    }
}
```

Avoid this if PHP 7.4 is in the matrix:

```php
// PHP 8+ only; not acceptable for a 7.4-compatible package.
final readonly class TestClock {
    public function __construct(private \DateTimeImmutable $now) {}
}
```

## Audit: Legacy WC Helper Antipatterns

### 1. Static god-helper APIs

Legacy:

```php
$order = Order::create_order([
    'user_id' => 4,
    'products' => [12, 13],
    'coupon' => 'SAVE10',
    'shipping' => true,
    'paid' => true,
]);
```

Problems:

- Ambiguous defaults and hidden side effects.
- Difficult to create a minimally valid fixture.
- Parameter arrays become undocumented pseudo-APIs.
- Promotes overly complete fixtures for simple behavior.
- Hard to add HPOS-mode control or strict validation.
- Often combines creation, persistence, totals, status transitions, and payment behavior in one call.

Replace with fluent, explicit builders and narrowly scoped convenience factories.

### 2. Direct order/coupon meta operations

Legacy:

```php
update_post_meta($order_id, '_my_plugin_token', 'abc');
$value = get_post_meta($order_id, '_my_plugin_token', true);
```

Why this is unsafe:

- It assumes an order is a WordPress post.
- It bypasses WooCommerce’s data-store abstraction.
- It can fail or produce inconsistent behavior under HPOS.
- It undermines meaningful storage-mode coverage.

Replace with:

```php
$order = wc_get_order($order_id);
$order->update_meta_data('_my_plugin_token', 'abc');
$order->save();

self::assertSame(
    'abc',
    wc_get_order($order_id)->get_meta('_my_plugin_token', true)
);
```

WooCommerce’s HPOS recipe guidance explicitly recommends order-object metadata methods plus `save()`, allowing WooCommerce to write to the appropriate active tables. [rudrastyh](https://rudrastyh.com/woocommerce/high-performance-order-storage.html)

The same principle applies to order status, customer ID, addresses, items, refunds, and queries:

```php
// Avoid.
$post = get_post($order_id);
$post->post_status = 'wc-completed';
wp_update_post($post);

// Use.
$order = wc_get_order($order_id);
$order->update_status('completed');
```

### 3. Direct SQL against WooCommerce storage

Direct SQL is justified only when testing:

- Your own custom database table/repository.
- A migration from explicitly known legacy data.
- Corrupt/partial data recovery.
- A low-level WooCommerce data-store contract that cannot be reached through public APIs.
- Performance diagnostics in a dedicated non-transactional test environment.

It is not justified for everyday “create an order” fixtures. Direct inserts may bypass hooks, caches, lookup table maintenance, object type metadata, version-specific schema behavior, and HPOS/CPT abstraction.

### 4. `TRUNCATE TABLE` in tests

Legacy:

```php
$wpdb->query("TRUNCATE TABLE {$wpdb->prefix}woocommerce_order_items");
```

Problems:

- Implicit commit breaks WordPress test transaction isolation.
- Can leave rows permanently in the test database.
- Causes order-dependent failures.
- Risks deleting data outside the test’s ownership.
- Deletes shared fixture state needed by other tests.

Use transaction rollback, tracked IDs, scoped deletes on plugin-owned tables, or a dedicated database reset job. WordPress documents that tests rely on a transaction started before each test and rolled back afterward. [make.wordpress](https://make.wordpress.org/core/handbook/testing/automated-testing/writing-phpunit-tests/)

### 5. One giant bootstrap for every test

Symptoms:

- Unit tests load WordPress/WooCommerce, start MySQL, initialize sessions, register every plugin hook, and build full products/orders.
- Test feedback takes seconds or minutes.
- Failures are hard to localize.
- Developers stop running tests locally.

Fix:

- Separate `phpunit.unit.xml.dist` and `phpunit.integration.xml.dist`.
- Keep pure PHP code free of global platform calls.
- Use interfaces/adapters at WordPress/WooCommerce boundaries.
- Run unit tests on every local change and every PR; run integration matrix and E2E in CI.

### 6. Global-state leakage

Common leaky state:

- `WC()->session`, `WC()->cart`, `WC()->customer`.
- Current user.
- Notices.
- Options and transients.
- Feature flags.
- `add_filter()` / `add_action()` registrations.
- Static caches and object caches.
- Action Scheduler jobs.
- `$_SERVER`, `$_POST`, `$_GET`, cookies.
- Locale, timezone, and currency.

Every test utility should make setup/teardown paired and scoped. Avoid helpers named `enable_hpos()` that rely on callers remembering to call `disable_hpos()` later; prefer `withinHposMode()` or a trait that restores state in teardown.

## Concrete Roadmap and v2.0 Delivery Plan

### Phase 0: Inventory and contract freeze

- Catalog every existing static helper in `wpdev/wc-core-test`.
- Classify each helper by fixture ladder level.
- Identify helpers that directly touch posts/postmeta, write SQL, truncate tables, modify globals, or depend on checkout/session state.
- Mark externally used methods as:
  - retained temporarily;
  - deprecated wrapper;
  - replaced;
  - removed in v3.0.
- Add characterization tests before refactoring legacy behavior.

Deliverable: a migration map such as:

| Legacy API | v2 replacement | Status |
|---|---|---|
| `Product::create_simple_product()` | `ProductBuilder::simple()->create()` | Deprecated wrapper |
| `Order::create_order()` | `OrderBuilder::new()->…->create()` | Deprecated wrapper |
| `Coupon::create_coupon()` | `CouponBuilder::new()->code()->create()` | Deprecated wrapper |
| Raw order-meta helper | `WC_Order::update_meta_data()` via builder or assertion | Remove |
| `truncate_*()` helper | `ResourceRegistry` / transactional cleanup | Remove immediately |

### Phase 1: Establish test boundaries

Create two test suites:

```xml
<!-- phpunit.unit.xml.dist -->
<phpunit bootstrap="tests/unit/bootstrap.php">
  <testsuites>
    <testsuite name="Unit">
      <directory>tests/Unit</directory>
    </testsuite>
  </testsuites>
</phpunit>
```

```xml
<!-- phpunit.integration.xml.dist -->
<phpunit bootstrap="tests/integration/bootstrap.php">
  <testsuites>
    <testsuite name="Integration">
      <directory>tests/Integration</directory>
    </testsuite>
  </testsuites>
</phpunit>
```

Composer scripts:

```json
{
  "scripts": {
    "test:unit": "phpunit -c phpunit.unit.xml.dist",
    "test:integration": "phpunit -c phpunit.integration.xml.dist",
    "test:integration:hpos": "phpunit -c phpunit.integration.xml.dist --group hpos",
    "test": [
      "@test:unit",
      "@test:integration"
    ]
  }
}
```

Ensure the unit bootstrap does **not** load WordPress, WooCommerce, or `wp-tests-lib`.

### Phase 2: Ship the first builders

Start small:

1. `ProductBuilder`
2. `CustomerBuilder`
3. `OrderBuilder`
4. `CouponBuilder`
5. `RefundBuilder`
6. `ShippingZoneBuilder`
7. `TaxRateBuilder`

Each builder should:

- Have safe, documented defaults.
- Persist via public WooCommerce CRUD.
- Return the actual WC object.
- Support a `withoutPersistence()` / `build()` mode only where meaningful.
- Avoid random data by default.
- Use deterministic identifiers and clocks where IDs/dates matter.
- Expose explicit totals behavior; never unexpectedly calculate totals.
- Make status/payment behavior opt-in.

Example product specification:

```php
ProductBuilder::simple()
    ->named(string $name)
    ->sku(string $sku)
    ->regularPrice(string $price)
    ->salePrice(string $price)
    ->virtual(bool $enabled = true)
    ->downloadable(bool $enabled = true)
    ->manageStock(int $quantity)
    ->stockStatus(string $status)
    ->withMeta(string $key, $value)
    ->inCategory($term_or_id)
    ->build(): \WC_Product_Simple
    ->create(): \WC_Product_Simple;
```

Example order specification:

```php
OrderBuilder::new()
    ->withCustomer(\WP_User $user)
    ->withCustomerId(int $user_id)
    ->withBillingAddress(array $address)
    ->withShippingAddress(array $address)
    ->withLineItem(\WC_Product $product, int $quantity = 1)
    ->withShippingMethod(string $rate_id, string $label, string $total)
    ->withFee(string $name, string $total, bool $taxable = false)
    ->withCoupon(\WC_Coupon $coupon)
    ->withMeta(string $key, $value)
    ->withStatus(string $status)
    ->withPaymentMethod(string $id, string $title)
    ->calculateTotals()
    ->paid(string $transaction_id = '')
    ->create(): \WC_Order;
```

### Phase 3: Add HPOS matrix support

- Introduce `OrderStorageController`.
- Provide `RunsWithOrderStorageModes`.
- Add focused testing under CPT and HPOS to every order-oriented builder.
- Validate that metadata, status changes, refunds, and order queries work in both modes.
- Add hard failure when a suite attempts a storage toggle after fixtures are already built.
- Verify no test relies on `wp_posts` or `postmeta` for order assertions.

A core compatibility test should look like:

```php
/**
 * @dataProvider orderStorageModes
 */
public function test_order_meta_round_trips_in_each_storage_mode(
    string $mode
): void {
    $this->setOrderStorageMode($mode);

    $order = OrderBuilder::new()
        ->withMeta('_wc_core_test_probe', 'expected-value')
        ->create();

    $reloaded = wc_get_order($order->get_id());

    self::assertSame(
        'expected-value',
        $reloaded->get_meta('_wc_core_test_probe', true)
    );
}
```

### Phase 4: Isolation utilities and dangerous-helper removal

- Replace all `TRUNCATE` usage.
- Add a `ResourceRegistry`.
- Add `OptionGuard`, `HookGuard`, `WcContextGuard`, `StorageModeGuard`, and `CacheGuard`.
- Migrate all direct order/coupon post-meta operations to CRUD.
- Add a static-analysis rule or grep-based CI guard that fails new uses of:
  - `update_post_meta(` for orders;
  - `get_post_meta(` for orders;
  - `WP_Query` for orders;
  - direct references to `shop_order`;
  - `TRUNCATE TABLE`;
  - direct `wp_posts` / `wp_postmeta` order assumptions.

WooCommerce’s HPOS migration advice specifically centers CRUD APIs and WooCommerce order queries rather than WordPress post APIs. [developer.woocommerce](https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/)

### Phase 5: CI matrix and external validation

Suggested CI stages:

| Job | Trigger | Scope |
|---|---|---|
| `lint` | Every PR | Coding standards |
| `phpstan` | Every PR | Static analysis |
| `unit` | Every PR / PHP matrix | No DB; target fast feedback |
| `integration-cpt` | Every PR | WP + Woo + MySQL, CPT orders |
| `integration-hpos` | Every PR | WP + Woo + MySQL, HPOS orders |
| `integration-version-floor` | Scheduled / release | Oldest supported WP/WC/PHP combination |
| `integration-version-ceiling` | Scheduled / release | Latest supported compatible stack |
| `qit` | Release candidate / Marketplace | Activation, compatibility, security, E2E/API as appropriate |
| `playwright` | Checkout/Blocks changes | Store API and checkout contract |

QIT is particularly suitable for the final installation/compatibility confidence layer because WooCommerce positions it as the Marketplace quality gateway with managed compatibility, activation, security, performance, static-analysis, and Playwright-oriented checks. [qit.woo](https://qit.woo.com/docs/)

## Final Recommendation

Build `wc-core-test` v2.0 around a **clear contract: builders create WooCommerce objects through public APIs, tests select an appropriate fixture level, and HPOS is a first-class execution dimension for order-related integration tests**.

The highest-value changes are:

1. Split pure unit tests from WP/Woo integration tests.
2. Replace static helper bags with explicit builders.
3. Eliminate direct order/coupon post-meta access and raw WooCommerce table fixtures.
4. Replace all `TRUNCATE` cleanup with transactions, tracked resources, and scoped deletion.
5. Make session/cart/notices explicit integration context, not an assumed global.
6. Run meaningful order tests in both HPOS and CPT modes.
7. Treat WooCommerce core test internals as inspiration rather than a dependency.
8. Use QIT/Playwright as the outer installation and checkout/Blocks confidence layer—not as a substitute for PHPUnit.

That architecture will give your team faster local feedback, stronger HPOS confidence, better failure isolation, and an API that can survive future WooCommerce storage and checkout changes.