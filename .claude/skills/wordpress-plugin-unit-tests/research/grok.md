# Modernizing WooCommerce Unit & Integration Testing  
## Architecture Report for `wpdev/wc-core-test` v2.0

---

## 1. Executive Summary & Ecosystem Reality Check

WooCommerce’s own PHP test stack has quietly become a **two-layer system**:

1. **Integration / WP-booted tests** — `WC_Unit_Test_Case` → `WP_HTTP_TestCase` → `WP_UnitTestCase`, MySQL, `$wpdb` transactions, CRUD objects, HPOS tables.
2. **Isolated / container-aware tests** — DI via `wc_get_container()`, `MockableLegacyProxy`, and the CodeHacker (Patchwork-style function/static rewriting). This is *not* Brain Monkey, but it is the same idea applied inside a booted WP.

There is **no official `woocommerce/test-framework` Composer package**. Helpers live inside the monorepo (`tests/legacy/framework/`, `tests/php/helpers/`, `tests/legacy/unit-tests/rest-api/Helpers/`) and are not versioned as a public API. Marketplace quality is enforced by **QIT** (`woocommerce/qit-cli`), not by a shared PHPUnit factory.

The most important official document for v2.0 is the current `plugins/woocommerce/tests/README.md` “performance and isolation principles.” It names the **fixture ladder**, forbids `TRUNCATE TABLE`, and tells authors to size fixtures to the assertion, not to realism. That document should be treated as the source of truth for any third-party helper library.

**Ecosystem snapshot (2026):**

| Layer | What exists | Fit for `wc-core-test` |
|---|---|---|
| WC core helpers | `WC_Helper_*`, REST `OrderHelper`/`ProductHelper`, `HPOSToggleTrait`, `HposTestCase` | Copy patterns, do **not** vendor-copy the files forever |
| Isolated mocks | Brain Monkey + Mockery; Yoast `wp-test-utils`; `ksfraser/mock-woocommerce` | Fast unit suite |
| Integration factories | `level-level/wp-browser-woocommerce`; Aztec `aztecweb-wp-browser` | Codeception/wp-browser shops |
| Volume data | `woocommerce/wc-smooth-generator`; `humanmade/woocommerce-demo-generator` | Perf / demo, **not** PHPUnit fixtures |
| Marketplace CI | `woocommerce/qit-cli` + HPOS feature flag | Complement, not replacement |

**Design implication:** `wc-core-test` v2.0 should be a **thin, typed factory + isolation layer** that speaks WooCommerce CRUD and HPOS, not a fork of 2016 static helpers.

---

## 2. Deep-Dive Findings per Pillar

### Pillar 1 — WooCommerce Core Testing Internals & Fixture Ladders

#### 1.1 Layout today

```
plugins/woocommerce/tests/
├── README.md                          # fixture ladder + isolation contract
├── php/
│   ├── helpers/                       # modern traits (HPOS, logger spy, cache)
│   ├── src/                           # PSR-4 tests for src/
│   └── includes/                      # new tests for includes/
├── legacy/
│   ├── framework/                     # WC_Unit_Test_Case, WC_Helper_*
│   └── unit-tests/                    # frozen; no new tests
└── Tools/CodeHacking/                 # function/static rewriting
```

PHPUnit 9.6, `yoast/phpunit-polyfills ^2.0`, Mockery 1.6, platform PHP 7.4. New test files are expected to use `declare(strict_types=1);`. Core CI also runs the suite with `DISABLE_HPOS=1` to exercise the CPT datastore.

#### 1.2 `HposTestCase` and `HPOSToggleTrait`

Both live under `tests/php/helpers/`.

**`HPOSToggleTrait`** (`Automattic\WooCommerce\RestApi\UnitTests`) is the switchboard for Custom Order Tables:

| Method | Role |
|---|---|
| `setup_cot()` | Drop WP PHPUnit *temporary table* filters, recreate permanent COT tables, enable HPOS |
| `clean_up_cot_setup()` | Disable HPOS, restore temporary-table filters |
| `setup_cot_tables()` | `DELETE FROM` all four HPOS tables (orders, addresses, operational_data, meta) — **not TRUNCATE** |
| `toggle_cot_authoritative(bool)` | Authoritative datastore = COT vs posts |
| `enable_cot_sync()` / `disable_cot_sync()` | `pre_option_{DataSynchronizer::ORDERS_DATA_SYNC_ENABLED_OPTION}` |

Critical detail: HPOS tables cannot live as WP PHPUnit temporary tables. The trait **removes** `_create_temporary_tables` / `_drop_temporary_tables` for the duration of the test. That is why HPOS tests are heavier and why cleanup must be explicit.

**`HposTestCase`** extends `WC_Unit_Test_Case` and adds *cross-store assertions*:

- `assert_order_record_existence($id, $in_cot, $must_exist)` — row in `wc_orders` **or** `wp_posts`
- `assert_deletion_record_existence(...)` — sync tombstone meta
- `do_cot_sync()` — run one `DataSynchronizer` batch
- `set_order_as_updated(...)` — poke `date_updated_gmt` / `post_modified_gmt` without going through CRUD

This is how core proves **CPT-authoritative + sync**, **HPOS-authoritative + sync**, and **HPOS-authoritative + sync off** without duplicating every test three times. The usual pattern:

```php
class OrdersTableDataStoreTests extends \HposTestCase {
    use HPOSToggleTrait;
    use CogsAwareUnitTestSuiteTrait;

    public function setUp(): void {
        parent::setUp();
        $this->setup_cot();
    }

    public function tearDown(): void {
        $this->clean_up_cot_setup();
        parent::tearDown();
    }
}
```

Third-party plugins should **not** subclass `HposTestCase` (it is not a packaged API). They should re-implement the *idea*: a trait that flips `FeaturesController` / `CustomOrdersTableController` options and a data provider that runs the same test in both modes.

#### 1.3 The fixture ladder (canonical)

From the official README, using orders as the example:

| Rung | API | Cost | Use when |
|---|---|---|---|
| 1. Full helper | `WC_Helper_Order::create_order()` / REST `OrderHelper::create_order()` | ~29 writes + hook cascade | Line items, addresses, shipping, totals are **part of the contract** |
| 2. Minimal production API | `wc_create_order( [ 'customer_id' => … ] )` then setters + `save()` | 1 write through the real datastore | Existence, counts, permissions, status transitions |
| 3. Boundary seed | Direct `INSERT` into the table the SUT **reads** | Cheapest, bypasses hooks | Lookup tables, analytics SQL, migration sources |

Same ladder for products: full `WC_Helper_Product` → `wc_get_product` factory + `save()` → lookup-table insert.

**Rule WC states explicitly:** keep at least one real CRUD write-path test per area so the sync path stays covered. Boundary seeding is not a substitute for “does `WC_Order::save()` still work under HPOS.”

#### 1.4 Traits third-party plugins should steal (conceptually)

From `tests/php/helpers/`:

| Trait / helper | What it actually does | Adopt? |
|---|---|---|
| `HPOSToggleTrait` | Feature + authoritative table + sync option | Yes — reimplement against public `FeaturesUtil` / options |
| `HposTestCase` | Cross-store existence / sync assertions | Yes — slim public assertion trait |
| `LoggerSpyTrait` | Mock `WC_Logger_Interface`, `assertLogged()`, `assertNoErrorLogged()` | Yes |
| `SerializingCacheTrait` | Swap `WP_Object_Cache` for a serialize/unserialize proxy | Only if you cache WC objects |
| `MetaDataAssertionTrait` | REST incomplete-`meta_data` fixtures | Only if you own REST controllers |
| `WC_Unit_Test_Case` helpers | `register_legacy_proxy_*`, `clear_hpos_orders()`, mock session, Tracks assertions | Selective |

`WC_Unit_Test_Case` also:

- installs `WC_Mock_Session_Handler` via `woocommerce_session_handler`
- empties cart, clears notices, resets cart context to `'shortcode'` on teardown
- `DELETE FROM` HPOS tables in `tearDownAfterClass()`
- exposes `LegacyProxy` mocks so `src/` code can be tested without Brain Monkey

That last point matters: **core’s “unit” tests still boot WordPress.** Isolation is done *inside* WP via the container, not by skipping WP.

#### 1.5 How core tests both datastores

Three orthogonal axes, not one boolean:

1. **Feature enabled** (`custom_order_tables`)
2. **Authoritative store** (COT vs posts)
3. **Compatibility sync** on/off

Recommended matrix for any plugin that *writes orders*:

| Mode | Feature | Authoritative | Sync | Why |
|---|---|---|---|---|
| A | on | HPOS | off | Default new shops (WC 8.2+) |
| B | on | HPOS | on | Migration / marketplace “compatibility mode” |
| C | off | CPT | n/a | Legacy stores; `DISABLE_HPOS=1` |

Do **not** invent a fourth mode unless you are testing the synchronizer itself.

Code should only talk to `wc_get_order()` / `$order->get_meta()` / `wc_get_orders()`. Direct `get_post_meta( $order_id )` is the #1 HPOS incompatibility. Declare compatibility with `FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true )`.

---

### Pillar 2 — Community & Commercial Extension Testing Patterns

#### 2.1 What serious extension teams actually do

There is no single house style. Patterns cluster:

**Automattic / Woo-owned extensions**  
Copy or require WooCommerce as a CI plugin, extend `WC_Unit_Test_Case` when they can reach it, and lean on **QIT** (`qit run:woo-api`, `qit run:woo-e2e`, `--optional_features=hpos`) as the marketplace gate. QIT is cloud-first; it is not a factory library.

**wp-browser shops (Level Level, WPGraphQL for WooCommerce, Aztec)**  
Codeception + `lucatume/wp-browser`. `level-level/wp-browser-woocommerce` adds `$this->factory()->product|order|coupon` that call the **WC REST controllers in-process** (not HTTP). That is HPOS-safe because it goes through CRUD. Aztec’s modules detect HPOS vs CPT and hide the difference behind `haveProductInDatabase()` / `seeOrderStatus()`.

**Classic PHPUnit + vendored helpers**  
The 2018 Automattic “wc-extensions-code-test-guide” and Steve Grunwell’s “Writing WooCommerce Extensions with Confidence” still describe the dominant pattern: `composer require --dev --prefer-source woocommerce/woocommerce`, classmap `tests/framework`, `require` the `WC_Helper_*` files in `bootstrap.php`. It works until WC moves a helper. It is also how many YITH / WPDesk-style suites still look: a `tests/framework` folder that is a snapshot of core helpers from some WC 3.x/7.x era.

**Pure unit (no MySQL)**  
Yoast `wp-test-utils` (Brain Monkey + PHPUnit Polyfills) and newer `ksfraser/mock-woocommerce` (fluent Product/Order mocks). Used for pricing math, DTO mapping, gateway request builders — not for “order saved to HPOS.”

#### 2.2 Composer packages — honest evaluation

| Package | Status | Verdict |
|---|---|---|
| `woocommerce/qit-cli` | Active, official | Marketplace + version matrix. Not a unit-test factory. |
| `level-level/wp-browser-woocommerce` | Maintained, narrow | Excellent if you already use wp-browser. REST-shaped factories. |
| `aztecweb/aztecweb-wp-browser` | New | HPOS-aware acceptance vocabulary. Not PHPUnit. |
| `woocommerce/wc-smooth-generator` | Official, active | WP-CLI volume data. Wrong grain for PHPUnit. |
| `humanmade/woocommerce-demo-generator` | Active | Same niche: demos / load, not assertions. |
| `ksfraser/mock-woocommerce` | Niche | Useful Brain-Monkey-adjacent fakes. Do not treat as WC API contract. |
| `yoast/wp-test-utils` | Active | Best Brain Monkey TestCase + polyfills. WP-oriented, not WC-specific. |
| `assertwell/wp-core-test-framework` | Maintenance | Replaces `install-wp-tests.sh`. Orthogonal. |
| `greys/wc-product-bundles-tests` | Product-specific | Pattern to copy for *your* product type, not a platform. |

**There is no healthy, official, decoupled `woocommerce/test-framework`.**

#### 2.3 Why Woo still will not ship one — and the clean workarounds

Reasons, inferred from how the monorepo is structured:

1. Helpers depend on **internal** types (`DataSynchronizer`, `OrdersTableDataStore`, `FeaturesController`, `LegacyProxy`, CodeHacker).
2. Test bootstrap is bound to WP PHPUnit’s temporary tables, hook snapshots, and `WP_UnitTestCase` transactions.
3. Automattic’s quality gate for *other people’s* plugins is QIT, not “please depend on our test classes.”
4. Publishing those classes would freeze an API they currently rewrite freely (`tests/legacy` is explicitly frozen for *tests*, not extracted as a library).

**Clean CI workarounds (ranked):**

1. **Do not vendor Woo test classes.** Depend on WooCommerce as a *plugin in the test WP install* (`wp-env`, wp-browser `WPLoader.plugins`, or QIT). Your library provides factories that call public CRUD.
2. If you must use `WC_Unit_Test_Case`, classmap only what you need from a **pinned Woo version** in CI, and treat upgrades as a chore — never as a runtime dependency of production plugins.
3. Split suites: `unit` (no WP) + `integration` (wp-env + Woo + HPOS matrix).
4. Use QIT for the “does this explode on WC latest + HPOS” axis so your own PHPUnit matrix can stay small.

---

### Pillar 3 — Fast Unit Testing vs Heavy Integration (Hybrid Model)

#### 3.1 Where Brain Monkey belongs

Brain Monkey + Mockery shine when the SUT is **a pure function or a class with function-shaped dependencies**:

```php
use Brain\Monkey;
use Brain\Monkey\Functions;
use Mockery;

class MoneyFormatterTest extends \Yoast\WPTestUtils\BrainMonkey\TestCase {
    public function test_formats_with_wc_price(): void {
        Functions\expect('wc_price')
            ->once()
            ->with(19.99)
            ->andReturn('<span>£19.99</span>');

        $this->assertSame('<span>£19.99</span>', (new Formatter())->format(19.99));
    }
}
```

Safe to mock without WP:

- `wc_price`, `wc_format_decimal`, `wc_get_price_decimals`
- `wc_get_order` / `wc_get_product` **when you only need a duck-typed object**
- `wc_add_notice`, `__`, `esc_html`, `get_option` (via `Functions\expect` or `stubs`)
- `WC()` as a tiny anonymous object `{ cart, session, customer }`

Not safe to “unit test” with mocks (these belong in integration):

- Anything that asserts **persistence** (meta written, stock decremented, order notes)
- Tax / shipping calculation that reads live settings + product tax classes
- HPOS vs CPT behavior
- Store API / Checkout Blocks side effects
- Webhooks, Action Scheduler, emails
- “Does my plugin’s `shop_order` SQL still work?” — if you still have that SQL, the test should fail under HPOS and force a CRUD rewrite

**Dividing line (use this in `wc-core-test` docs):**

> If the test can pass with an in-memory fake `WC_Order` that never hits `$wpdb`, it is a unit test.  
> If the test’s value is “the datastore / hooks / session actually did X,” it is an integration test.

#### 3.2 Sessions, carts, notices — the `get() on null` problem

This is the most common third-party test crash. Causes:

- `WC()->session` is only initialized on frontend-ish requests
- REST / cron / PHPUnit bootstrap is not “frontend”
- `WC()->cart` is null until `wc_load_cart()`
- Notices live in session; empty session + `wc_add_notice()` fatals or no-ops

**Integration-test recipe (mirrors core):**

```php
add_filter('woocommerce_session_handler', static fn () => WC_Mock_Session_Handler::class);

if (is_null(WC()->session)) {
    WC()->initialize_session(); // or: WC()->session = new WC_Session_Handler(); WC()->session->init();
}
if (is_null(WC()->cart)) {
    wc_load_cart();
}
WC()->cart->empty_cart(false);
wc_clear_notices();
```

Prefer `wc_load_cart()` over assigning `WC()->session = new WC_Session_Handler()` (that clobber is a known antipattern).

**Unit-test recipe:**

```php
$session = Mockery::mock();
$session->shouldReceive('get')->andReturn(null);
$session->shouldReceive('set')->andReturnNull();

$cart = Mockery::mock();
$cart->shouldReceive('get_cart')->andReturn([]);

Functions\when('WC')->justReturn(new class($cart, $session) {
    public $cart;
    public $session;
    public function __construct($cart, $session) {
        $this->cart    = $cart;
        $this->session = $session;
    }
});
Functions\when('wc_add_notice')->justReturn(null);
Functions\when('wc_get_notices')->justReturn([]);
```

`wc-core-test` v2.0 should ship both: `StorefrontContext::boot()` (integration) and `StorefrontContext::fake()` (unit).

---

### Pillar 4 — Recommended Architecture for `wc-core-test` v2.0

#### 4.1 Design pattern: fluent builders over static helpers

Static `Product::create_simple_product()` is the 2016 WC style. It hides cost (always rung 1 of the ladder) and grows untyped `$args` arrays.

Replace with **builders that default to the cheapest rung that can satisfy the declared intent**:

```php
$product = ProductBuilder::simple()
    ->priced('19.99')
    ->sku('SKU-1')
    ->create();                 // rung 2: new WC_Product_Simple + save()

$order = OrderBuilder::new()
    ->customer($user)
    ->item($product, 2)
    ->billing(['country' => 'US'])
    ->paid()
    ->create();                 // rung 1 only because items + paid need full commerce

$ids = OrderSeeder::inCurrentDatastore()
    ->status('wc-completed')
    ->count(50)
    ->seed();                   // rung 3: used only by query/pagination tests
```

Keep a compatibility façade for one major version:

```php
/** @deprecated 2.0 Use ProductBuilder::simple()->create() */
public static function create_simple_product(): WC_Product {
    return ProductBuilder::simple()->create();
}
```

#### 4.2 HPOS & datastore compatibility

Helpers must **never** choose a table. They call CRUD. Mode is a *test concern*:

```php
final class DatastoreMatrix {
    public const HPOS          = 'hpos';
    public const HPOS_SYNC     = 'hpos_sync';
    public const CPT           = 'cpt';
}

trait RunsOnDatastoreMatrix {
    /** @dataProvider datastore_modes */
    public function test_refund_keeps_meta(string $mode): void {
        Datastore::enter($mode);
        // arrange / act / assert via CRUD only
    }

    public function datastore_modes(): array {
        return [
            'hpos'      => [DatastoreMatrix::HPOS],
            'hpos_sync' => [DatastoreMatrix::HPOS_SYNC],
            'cpt'       => [DatastoreMatrix::CPT],
        ];
    }
}
```

`Datastore::enter()` implementation sketch:

- CPT: `FeaturesController::change_feature_enable('custom_order_tables', false)` (or option filters)
- HPOS: ensure schema via `OrdersTableDataStore::get_database_schema()` / WC install APIs, then enable feature + set authoritative
- Sync: `pre_option_` filter on `woocommerce_custom_orders_table_data_sync_enabled`
- Cleanup: `DELETE FROM` HPOS tables (copy `HPOSToggleTrait::setup_cot_tables`), restore options, restore WP temporary-table filters if you touched them

Expose assertions:

```php
OrderAssert::existsInAuthoritativeStore($id);
OrderAssert::existsInPosts($id);      // only meaningful with sync on
OrderAssert::metaEquals($order, '_foo', 'bar');  // via $order->get_meta()
```

Never assert `get_post_meta($order_id, '_foo', true)` in a shared helper.

#### 4.3 Database & state cleanup

Follow WC’s contract literally:

- Tests that extend `WP_UnitTestCase` **must** call `parent::setUp()` *before* any write the rollback should cover.
- **Never `TRUNCATE`.** Implicit commit aborts the test transaction; the next test sees leftover rows *and* the current test’s writes survive.
- Use `DELETE FROM` for HPOS tables, `woocommerce_order_items`, itemmeta, tax rates, shipping zones.
- Do not fight the parent hook snapshot; extra `remove_all_filters` mid-test is only for “this later assertion must not see that hook.”
- Class-level immutable catalogs go in `wpSetUpBeforeClass()` / `wpTearDownAfterClass()`.
- Reset process state yourselves: cart, session, notices, `WC()->countries->locale`, shipping method globals, tax rates, `WC_Cache_Helper::invalidate_cache_group`.

Suggested teardown trait:

```php
trait ResetsCommerceState {
    protected function tearDown(): void {
        $this->reset_cart_and_session();
        $this->reset_notices();
        $this->delete_created_shipping_zones();
        $this->delete_created_tax_rates();
        $this->delete_created_fees();
        parent::tearDown();
    }
}
```

Track created IDs on the builder (`->create()` pushes onto a test-scoped ledger) instead of “delete all shop_orders,” which races with class-level fixtures.

#### 4.4 PHP & toolchain

| Constraint | Recommendation |
|---|---|
| PHP | 7.4–8.3 in CI. `declare(strict_types=1)` everywhere new. Typed properties where 7.4 allows. |
| PHPUnit | 9.6 + `yoast/phpunit-polyfills` (same as WC). Do not jump to PHPUnit 10 until WC does — WP core test adapter is the limiter. |
| Mocking | Mockery + Brain Monkey in the `unit` suite only. Integration suite uses real WC. |
| WP | `WP_UnitTestCase` polyfilled method names (`set_up` / `setUp`) — call the same name you override. |
| WC versions | Integration matrix: current stable, previous stable, `rc`. HPOS on by default; one CPT job. |
| Style | PSR-4 `WpDev\WcCoreTest\...`. No classmap of WC internals. |

---

## 3. Audit of Antipatterns in Legacy WC Helpers

These are the landmines `wc-core-test` v1.x inherited from `WC_Helper_*` / early plugin suites.

| Antipattern | Why it hurts now | Replacement |
|---|---|---|
| `TRUNCATE TABLE` / `wp_posts` wipe | Implicit commit; breaks `WP_UnitTestCase` rollback; poisons isolation | `DELETE FROM`; rely on transaction + ID ledger |
| `update_post_meta( $order_id, … )` / `get_post_meta` on orders & coupons | Wrong table under HPOS; silent data loss when sync is off | `$order->update_meta_data()` + `save()`; `CRUD` for coupons |
| `WP_Query` / `get_posts( [ 'post_type' => 'shop_order' ] )` | Misses HPOS orders | `wc_get_orders()` |
| Raw SQL on `wp_posts` / `wp_postmeta` for orders | Same | `OrdersTableQuery` or `wc_get_orders` |
| Always `WC_Helper_Order::create_order()` | 29 writes when the test needed an ID | Fixture ladder; builders with explicit rung |
| `wp_insert_post` + postmeta for products (pre-CRUD helper copies) | Skips product data store, lookup tables, attributes | `new WC_Product_Simple()` + setters + `save()` |
| Creating a flat-rate shipping method **globally** per order helper | Leaks zones into later tests; not rolled back if options table quirks | Builder-owned zone; delete in teardown ledger |
| Setting `$order->set_total(50)` without `calculate_totals()` | Totals diverge from items; HPOS operational table disagrees | `calculate_totals()` unless the test *is* about forced totals |
| `$_SERVER['REMOTE_ADDR'] = '127.0.0.1'` sprinkled in helpers | Hidden global mutation | One `HttpContext::stub()` in base setUp |
| `sleep()` for “wait for timestamp” | Flaky, slow | `$order->set_date_modified()` / `set_order_as_updated()` |
| Network in tests | Non-deterministic | `$this->http_responder` / Mockery HTTP |
| Copy-pasted `tests/framework` from WC 3.x | Helpers still `update_post_meta`; no HPOS | Delete the vendored tree |
| Assigning `WC()->session = new WC_Session_Handler()` | Replaces the singleton mid-request | `wc_load_cart()` / `initialize_session()` |
| Asserting on `wp_posts.post_status` for orders | HPOS status lives in `wc_orders.status` | `$order->get_status()` |
| Class-level fixtures that **mutate** | Rollback does not cover `setUpBeforeClass` writes | Immutable catalogs only; or recreate per test |
| Forgetting `parent::setUp()` before first write | Writes land outside the transaction | Lint rule / base class that writes a canary |
| Testing Blocks checkout with shortcode cart context | Core resets cart context to `'shortcode'` on teardown for a reason | Explicit `CartContext::blocks()` vs `::shortcode()` |
| Declaring HPOS *incompatible* to skip work | QIT validation **fails** marketplace submissions that declare incompatibility | Fix CRUD; declare compatible |

Legacy `WC_Helper_Product::create_simple_product()` in old copies still does `wp_insert_post` + `update_post_meta('_price', '10')`. Current core helpers go through product objects. If your v1 library still has the postmeta version, treat it as a defect, not a feature.

---

## 4. Concrete Roadmap & API Spec for `wc-core-test` v2.0

### 4.1 Package shape

```
wpdev/wc-core-test
├── src/
│   ├── Unit/                      # Brain Monkey base + fakes (no WP)
│   │   ├── UnitTestCase.php
│   │   ├── Fake/Order.php
│   │   ├── Fake/Product.php
│   │   └── StorefrontContext.php  # fake WC()/cart/session/notices
│   ├── Integration/               # requires booted WP + WC
│   │   ├── IntegrationTestCase.php
│   │   ├── Datastore.php
│   │   ├── RunsOnDatastoreMatrix.php
│   │   └── ResetsCommerceState.php
│   ├── Builder/
│   │   ├── ProductBuilder.php
│   │   ├── VariationBuilder.php
│   │   ├── OrderBuilder.php
│   │   ├── CouponBuilder.php
│   │   ├── CustomerBuilder.php
│   │   ├── ShippingZoneBuilder.php
│   │   └── TaxRateBuilder.php
│   ├── Seed/                      # rung-3 boundary inserts
│   │   └── OrderSeeder.php
│   ├── Assert/
│   │   ├── OrderAssert.php
│   │   └── LoggerSpy.php
│   └── Compat/                    # deprecated static façades
└── docs/fixture-ladder.md
```

Composer:

```json
{
  "name": "wpdev/wc-core-test",
  "require": {
    "php": ">=7.4"
  },
  "require-dev": {
    "phpunit/phpunit": "^9.6",
    "yoast/phpunit-polyfills": "^2.0",
    "brain/monkey": "^2.6",
    "mockery/mockery": "^1.6"
  },
  "suggest": {
    "woocommerce/woocommerce": "Required at runtime of the integration suite",
    "woocommerce/qit-cli": "Marketplace matrix / HPOS feature jobs"
  }
}
```

Do **not** `require` WooCommerce. Integration tests should fail loudly with “WooCommerce not loaded” rather than pull a plugin into vendor.

### 4.2 Public API spec (minimal)

```php
namespace WpDev\WcCoreTest\Builder;

final class OrderBuilder
{
    public static function new(): self;

    public function customer(\WP_User|int $user): self;
    public function guest(string $email): self;
    public function status(string $status): self;          // pending|processing|completed|…
    public function item(\WC_Product|int $product, int $qty = 1, array $args = []): self;
    public function coupon(\WC_Coupon|string $coupon): self;
    public function billing(array $address): self;
    public function shipping(array $address): self;
    public function shippingMethod(string $id, float $cost): self;
    public function fee(string $name, float $amount): self;
    public function paid(): self;                          // payment_method + set_date_paid + status
    public function meta(string $key, $value): self;       // CRUD meta only
    public function calculateTotals(bool $on = true): self;

    /** Rung 1–2. Always WC_Order::save(). */
    public function create(): \WC_Order;

    /** Rung 2 only: wc_create_order() + optional status. No items. */
    public function createBare(): \WC_Order;
}
```

```php
namespace WpDev\WcCoreTest\Integration;

final class Datastore
{
    public static function current(): string;
    public static function enter(string $mode): void;
    public static function leave(): void;                  // restore previous mode
    public static function isHpos(): bool;                 // OrderUtil::custom_orders_table_usage_is_enabled()
}
```

```php
namespace WpDev\WcCoreTest\Unit;

abstract class UnitTestCase extends \PHPUnit\Framework\TestCase
{
    // Brain\Monkey\setUp/tearDown + MockeryPHPUnitIntegration
    protected function fakeWooCommerce(?object $cart = null, ?object $session = null): void;
}
```

```php
namespace WpDev\WcCoreTest\Integration;

abstract class IntegrationTestCase extends \WC_Unit_Test_Case // if present
    // else WP_UnitTestCase
{
    use ResetsCommerceState;
    // parent::setUp() first; StorefrontContext::boot();
}
```

### 4.3 Migration roadmap

**Phase 0 — Policy (1 week)**  
Write the fixture-ladder doc. Ban `TRUNCATE`, `get_post_meta` on orders, and vendored `tests/framework` in CI lint (phpcs sniff or Rector).

**Phase 1 — Dual API (2–3 weeks)**  
Ship builders + deprecated static façades. Existing `Product::create_simple_product()` delegates to `ProductBuilder`. No behavior change required of consumers.

**Phase 2 — Isolation (2 weeks)**  
`UnitTestCase` + `StorefrontContext::fake()`. Move pricing / request-building tests out of MySQL jobs. Target: unit job &lt; 5s on CI.

**Phase 3 — HPOS matrix (2–3 weeks)**  
`Datastore` + `RunsOnDatastoreMatrix`. Run plugin order tests in modes A/C always; mode B nightly. Add QIT `--optional_features=hpos` as a separate pipeline, not as a PHPUnit provider (too slow).

**Phase 4 — Delete the past (1 week + one major bump)**  
Remove static helpers, remove any copied `WC_Helper_*`, remove `update_post_meta` paths. v2.0 stable.

### 4.4 CI sketch

```yaml
jobs:
  unit:
    # no mysql, no wp
    run: vendor/bin/phpunit --testsuite=unit

  integration:
    strategy:
      matrix:
        php: ['7.4', '8.1', '8.3']
        wc: ['latest', 'previous']
        datastore: ['hpos', 'cpt']
    # wp-env or wp-browser WPLoader with Woo + plugin
    run: vendor/bin/phpunit --testsuite=integration

  qit:
    run: qit run:activation $SLUG --optional_features=hpos
```

### 4.5 Success criteria

- Creating an order in tests never mentions `wp_posts`.
- A test that only needs “an order ID exists” does not add line items.
- HPOS-off and HPOS-on jobs both green without `if ( OrderUtil::... )` inside production helpers.
- Suite has zero `TRUNCATE` and zero order `get_post_meta`.
- Unit suite does not load `wp-load.php`.
- `SpeedTrap` / PHPUnit duration: integration tests that only check a calculator should have moved to unit.

---

### Closing architectural rule

WooCommerce core already told the ecosystem what v2.0 should be: **pay only for what you assert, climb down the fixture ladder, never TRUNCATE, talk to CRUD, toggle HPOS at the test boundary — not inside the factory.**

`wc-core-test` v2.0 succeeds if plugin authors can write:

```php
$order = OrderBuilder::new()->item($product)->paid()->create();
$this->assertSame('processing', $order->get_status());
```

…and that test is valid on CPT, HPOS, and HPOS+sync without the builder knowing which one is active.