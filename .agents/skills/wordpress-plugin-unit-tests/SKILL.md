---
name: wordpress-plugin-unit-tests
description: >-
  Scaffolds and writes WordPress plugin unit tests using self-contained local
  path packages (wpdev/plugin-core-test, wpdev/wc-core-test), PHPUnit (random execution order),
  mirrored tests/unit-tests layout, mandatory TDD (red then green), REST/Ajax
  patterns, factories, and mocks. Use when adding unit tests, phpunit.xml,
  bootstrap.php, PluginBaseTestCase, RestTestCase, BaseAjaxTestCase,
  HttpTestCase (HttpMock), WooCommerce tests (OrderBuilder, ProductBuilder, CheckoutSimulator, HPOS, ActionSchedulerSpy),
  test-driven plugin work, or running PHPUnit in Docker without local MySQL.
---

# WordPress Plugin Unit Tests

Unit-test guidance for WordPress plugins using **`wpdev/plugin-core-test`** (`WPDevTest\`) and **`wpdev/wc-core-test`** (`WPDevTest\Woocommerce\`). Extend the package **`TestCase`** hierarchy (or **`BaseAjaxTestCase`** for Ajax — separate branch, not a child of `TestCase`). Never extend `WP_UnitTestCase` directly in plugin tests.

**Complements:** [wp-plugin-development](../wp-plugin-development/SKILL.md) (implementation); this skill covers **how to test**.

**Reference implementation:** Package API in [`packages/plugin-core-test/src/TestCases/`](packages/plugin-core-test/src/TestCases/) and [`packages/wc-core-test/src/`](packages/wc-core-test/src/).

> **Warning — do not copy the sample naming.** Bundled package tests use old conventions (`test_*` methods, `Test*.php` filenames, `prefix="Test"` discovery). **Plugin tests must use this skill's rules:** `@test` annotation, `itShouldVerbOutcome()` method names, `*Test.php` filenames. Read the samples for API usage only.

**Scope:** unit tests only (`tests/unit-tests/`). Acceptance/integration tests are out of scope.


## Supported toolchain

| Component | Version | Note |
|-----------|---------|------|
| PHP | 7.4 – 8.1 | Bundled Docker image is `wordpress:php8.1-apache` |
| PHPUnit | **9.x only** (`^9.6`) | PHPUnit 10+ fatals: `BaseTestCase::expectFilter()` uses `setMethods()` |
| `yoast/phpunit-polyfills` | `^1.1` — required | WordPress ≥ 5.9 test bootstrap aborts without it |
| WordPress | ≥ 5.9 (`wordpress-develop` checkout) | Package test cases use `setUp(): void` / `tearDown(): void` |
| MySQL | Host install **or** bundled [Docker stack](docs/docker-phpunit.md) | No local MySQL needed with Docker |

## DO / DON'T

**DO**

- Create `PluginBaseTestCase` **before** extending it, if the file does not exist.
- Register custom factories in `tests/unit-tests/bootstrap.php`, not only in a base class.
- Register a hook, **then** assert it with `expectAddAction()`.
- Give every assertion a failure message.
- Pin PHPUnit `^9.6` and add `yoast/phpunit-polyfills`.
- Run the suite in random order, every time.
- Execute real plugin bootstrap in an isolated PHP process (or Linux Docker container) when smoke-testing release distribution zips.
- Verify bootstrap and tests in a Linux container (e.g. Docker) to detect case-sensitive file path defects hidden by macOS APFS.

**DON'T**

- Don't extend `WP_UnitTestCase` directly in plugin tests — extend the `WPDevTest\TestCases\*` hierarchy.
- Don't extend a `PluginBaseTestCase` that was never created.
- Don't register factories only in `setUp()` — random order means another class may build the factory first.
- Don't call `expectAddAction()` before the hook is registered — it inspects `$wp_filter` and throws.
- Don't pass a capability to `login()` — it takes a role slug (`administrator`, not `manage_options`).
- Don't use `suffix=".php"` for test discovery — it loads `bootstrap.php` and abstract bases as tests.
- Don't hardcode machine paths (`/Users/...`) in `phpunit.xml.dist` or `bootstrap.php`.
- Don't copy the bundled package sample naming (`test_*`, `Test*.php`) into plugin tests.
- Don't add a `tests:pre` composer script unless `tests/patch/apply-patches.php` exists.
- Don't skip the red step or backfill tests after writing production code.
- Don't assume a single-plugin PHPUnit boot covers activation: siblings may already own shared FQCNs — see [activation-shared-fqcn.md](references/activation-shared-fqcn.md).
- Don't use `createTestProxy` — use `WPDevTest\Proxy\ObjectProxy` or `createMock()`.
- Don't pin PHPUnit `^10`+ — `BaseTestCase::expectFilter()` uses `setMethods()`, removed in 10.
- Don't edit the bundled `packages/` from a consumer plugin.
- Don't write shallow smoke tests that only check `test -f` or `is_readable()`. They yield **False Greens** — a file can exist on disk while containing broken class references, missing internal dependencies, or wrong case-sensitivity.
- Don't rely on macOS test execution as proof of filesystem safety: APFS is case-insensitive, while production Linux is strictly case-sensitive.

## Greenfield procedure

Follow in order. Each step has a check; do not continue past a failed check.

1. **Copy packages** — copy `{skill-root}/packages/plugin-core-test/` to `{plugin-root}/packages/`. Add `wc-core-test/` only for WooCommerce. → [private-packages.md](references/private-packages.md)
2. **Merge `composer.json`** — path repository `packages/*`, PSR-4 autoload (`{Vendor}\{Plugin}\` → `src/`) and autoload-dev (`{Vendor}Test\{Plugin}\` → `tests/unit-tests/`), require-dev `phpunit/phpunit ^9.6` + `yoast/phpunit-polyfills ^1.1` + `wpdev/plugin-core-test ^1.2`, script `"tests": "phpunit"`. → [scaffolding.md](references/scaffolding.md)
3. **`composer install`** — check: `./vendor/bin/phpunit --version` reports PHPUnit 9.x.
4. **Create `phpunit.xml.dist`** — `executionOrder="random"`, `<directory suffix="Test.php">./tests/unit-tests/</directory>`, exclude `TestCases/`, set `WP_TESTS_DIR`, `BOOTSTRAP_FILE` to the plugin main file, and `PLUGIN_ROOT`. → [scaffolding.md](references/scaffolding.md)
5. **Create `tests/unit-tests/bootstrap.php`** — autoload + `WPDevTest\Setup::setup()`; register custom factories inside the callback. → [factories.md](references/factories.md)
6. **Create `tests/unit-tests/TestCases/PluginBaseTestCase.php`** if missing. → [test-base-classes.md](references/test-base-classes.md)
7. **Verify the scaffold** before writing feature tests:

```bash
./vendor/bin/phpunit --version          # PHPUnit 9.x
test -d vendor/yoast/phpunit-polyfills  # required by WP >= 5.9
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

8. **Red** — write the first mirrored `*Test.php` (template below), run `composer tests`, confirm it **fails**.
9. **Green** — write minimal production code in `src/`, run again, confirm it **passes**.

**No local MySQL?** Keep steps 1–7, then run steps 8–9 in the bundled Docker stack instead of on the host: copy [`assets/docker-phpunit/`](assets/docker-phpunit/) outside the plugin, `cd` into it, set `PLUGIN_ROOT` + `WORDPRESS_DEVELOP_ROOT` + `PLUGIN_MAIN_FILE` in `.env`, `chmod +x run-phpunit.sh teardown.sh`, then `./run-phpunit.sh`. For WooCommerce, also set `WOOCOMMERCE_ROOT`. → [docs/docker-phpunit.md](docs/docker-phpunit.md)

## Minimal first test

Paste, rename, make it fail, then implement:

```php
<?php

declare( strict_types=1 );

namespace VendorTest\Plugin;

// Replace Vendor\Plugin with the real production/test namespaces.
use VendorTest\Plugin\TestCases\PluginBaseTestCase;
use Vendor\Plugin\Greeter;

class GreeterTest extends PluginBaseTestCase {

	/**
	 * @test
	 */
	public function itShouldReturnGreetingForGivenName(): void {

		$this->assertSame(
			'Hello, Ada',
			( new Greeter() )->greet( 'Ada' ),
			'Greeter::greet() did not return the expected greeting'
		);
	}
}
```

## TDD loop (mandatory)

Always use TDD for new behavior and bug fixes. Do **not** write or change production code until a new/updated test has failed at least once.

1. **Red** — Add mirrored `*Test.php` with `@test` method `itShould…()` (or extend an existing test). Run PHPUnit; the new test **must fail**. If it passes without new production code, the test is wrong — fix the test and re-run until it fails.
2. **Green** — Implement the minimal production code in mirrored `src/` so the failing test passes.
3. **Refactor** — Clean production code; keep tests green.
4. **Scope** — One behavior per method; shared arrange in `setUp()`, `@dataProvider`, or fixtures.

Never skip the Red step. Never implement first and “backfill” tests afterward.

## Random test order (mandatory)

Tests must run in **random order** so hidden order dependencies surface. Configure this in scaffolding and keep it on for every run:

- In `phpunit.xml.dist`: `executionOrder="random"` on the root `<phpunit>` element (see [scaffolding.md](references/scaffolding.md)).
- Prefer `composer tests` / `./vendor/bin/phpunit` with that config; if invoking CLI flags, use `--order-by=random`.
- Do not rely on test method order, shared mutable state across tests, or “this test runs first” assumptions. Each test must be independent.

## Directory layout

```
plugin-root/
├── packages/                     # copied from skill/packages/
│   ├── plugin-core-test/         # always
│   └── wc-core-test/             # optional (WooCommerce)
├── src/                          # plugin source
├── tests/
│   ├── unit-tests/               # all unit tests
│   │   ├── bootstrap.php         # always
│   │   ├── TestCases/            # plugin base classes (no src mirror)
│   │   └── …                     # mirrors src/
│   └── plugins-list.php          # only when other plugins required
├── phpunit.xml.dist              # always
└── composer.json                 # path repositories
```

## File mirroring

| Source | Test |
|--------|------|
| `src/Model.php` | `tests/unit-tests/ModelTest.php` |
| `src/DoComplex.php` (many tests) | `tests/unit-tests/DoComplex/ApiTest.php`, `ParseTest.php`, … |
| `src/.../DeleteRestHandler.php` | `tests/.../DeleteRestHandler/DeleteTest.php` |

- Append **`Test`** to class and file names.
- Split into a **subfolder** when one source file needs many test classes.
- **REST handlers:** subfolder named after handler class; test file named by behavior.

Plugin bases (`PluginBaseTestCase`, `RestTestCase`, `AdminTestCase`) live in `tests/unit-tests/TestCases/` — not mirrored from `src/`.

## Env vars (set in `phpunit.xml.dist`)

| Variable | Required? | Behavior when missing |
|----------|-----------|-----------------------|
| `WP_TESTS_DIR` | **Required** | `_tests_dir()` throws — the suite cannot start |
| `BOOTSTRAP_FILE` | **Required for plugin tests** | Without it, `Setup` does not load the plugin main file |
| `PLUGIN_ROOT` | Recommended | `Setup` sniffs the root from the `vendor/` path; set it explicitly to be safe |
| `ACTIVE_PLUGINS` | Only with other plugins | No extra plugins activated |
| `ALL_PLUGINS_ROOT` | Only with other plugins | `ALL_PLUGINS_DIR_ABS` falls back to `dirname( PLUGIN_ROOT )` — wrong under Docker, where the plugin is mounted alone |
| `WPML_ENABLED` | Optional | WPML mock not loaded |

Details: [scaffolding.md](references/scaffolding.md).

## Namespace (composer autoload-dev)

Append `Test` to the **first** PSR-4 segment; keep the rest:

| Production | Tests |
|------------|-------|
| `WPDev\Core\Rest` | `WPDevTest\Core\Rest` |
| `WPDevSale\` | `WPDevSaleTest\` |

Map test namespace to `./tests/unit-tests/`.

## Base class picker

**Default:** extend plugin **`PluginBaseTestCase`**. If `tests/unit-tests/TestCases/PluginBaseTestCase.php` does not exist, create it first from the template in [test-base-classes.md](references/test-base-classes.md). Use `WPDevTest\TestCases\TestCase` only for pure bootstrap/setup tests (no domain factories).

| Need | Extend |
|------|--------|
| Domain / feature logic | Plugin `PluginBaseTestCase` (or child) |
| Plugin hooks / activation only | `WPDevTest\TestCases\TestCase` |
| Outbound HTTP / external APIs | `WPDevTest\TestCases\HttpTestCase` (or use `IntersectsHttp`) |
| WooCommerce integration (HPOS / DB) | `WPDevTest\Woocommerce\Integration\TestCase` (or plugin child) |
| WooCommerce pure unit (in-memory / Mockery) | `WPDevTest\Woocommerce\Unit\UnitTestCase` |
| Admin UI | Plugin `AdminTestCase extends PluginBaseTestCase` |
| REST endpoint | Plugin `RestTestCase` — `rest_handler_instance()` + `init()` |
| `wp_ajax_*` | `WPDevTest\TestCases\BaseAjaxTestCase` or plugin wrapper |
| Raw SQL | `WPDevTest\TestCases\DBTestCase` |
| WPML mock | `MultiLangTestCase` + `WPML_ENABLED=1` in phpunit |
| Script enqueue | `LibraryTestCase` |

Details: [test-base-classes.md](references/test-base-classes.md).

## WooCommerce testing (`wpdev/wc-core-test` v2.0)

When testing WooCommerce features, copy `packages/wc-core-test/` into `{plugin-root}/packages/` and require `"wpdev/wc-core-test": "^2.0"`. Full guide: [wc-core-test.md](references/wc-core-test.md).

**Core patterns:**
- **Base class**: Extend `WPDevTest\Woocommerce\Integration\TestCase` (automatically boots `WC()->session` and `WC()->cart` with safe `try/finally` state teardown).
- **Builders** (avoid direct post inserts or legacy mutations):
  - Orders: `OrderBuilder::new()->withCustomer($uid)->withItem($product, 2)->asPaidState()->create();`
  - Products: `ProductBuilder::new()->named('Pro')->priced(99)->inStock(10)->create();` (Simple, Variable, Grouped, External)
  - Coupons: `CouponBuilder::new()->code('SAVE10')->percent(10)->create();`
  - Customers, Tax Rates, Shipping Zones, Refunds: `CustomerBuilder`, `TaxRateBuilder`, `ShippingZoneBuilder`, `RefundBuilder`.
- **Checkout simulation**:
  - `CheckoutSimulator::new()->withProduct($p)->withPaymentMethod('bacs')->processCheckout();`
- **Spies & Mocks**:
  - Action Scheduler: `ActionSchedulerSpy::assertActionScheduled('hook', $args);` and `ActionSchedulerSpy::runDueActions();`
  - Store API / Blocks: `StoreApiRequest::post('/wc/store/v1/cart/add-item', ['id' => $id, 'quantity' => 1]);`
  - Emails / Logs: `EmailSpy::assertSentTo('user@example.com');`, `LoggerSpy::assertLogged('warning', '...');`
  - Payment Gateways: `MockPaymentGateway::register('mock_gateway')->willSucceed();`
- **HPOS Matrix**:
  - Test across data stores via `DatastoreMatrix::switch_to(DatastoreMatrix::HPOS_AUTHORITATIVE);` and `DatastoreMatrix::switch_to(DatastoreMatrix::LEGACY_CPT);`
- **Zero TRUNCATE & State Reset**:
  - Never call `TRUNCATE TABLE`. Zone and tax cleanup is automated via `ResourceRegistry`. Session/cart cleanup is automated via `WooStateResetter`.


## Outbound HTTP Mocking (`WPDevTest\Http\HttpMock`)

Zero-dependency, fail-closed HTTP mocking for external API calls (`wp_remote_get`, `wp_remote_post`, `wp_remote_request`). Prevents live network leaks, asserts requests, and cleanly resets in `tearDown()`.

### Quickstart

```php
use WPDevTest\TestCases\HttpTestCase;
use WPDevTest\Http\HttpMock;
use WPDevTest\Http\RecordedRequest;

class PaymentSyncTest extends HttpTestCase {

    /** @test */
    public function itShouldPostOrderToPaymentGateway(): void {
        HttpMock::preventStrayRequests();
        HttpMock::fake([
            'https://adminapi.tamland.ir/api/payment/savePayment*' => HttpMock::json([
                'Code' => 200,
                'Data' => [ 'STATUS' => 1, 'MESSAGE' => 'موفق' ],
            ], 200),
        ]);

        $res = wp_remote_post('https://adminapi.tamland.ir/api/payment/savePayment?dry_run=0', [
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => json_encode(['Mobile' => '09120000000']),
        ]);

        $this->assertSame(200, wp_remote_retrieve_response_code($res));

        HttpMock::assertSent(function (RecordedRequest $req) {
            return $req->method() === 'POST'
                && $req->header('content-type') === 'application/json'
                && $req->json('Mobile') === '09120000000';
        });

        HttpMock::assertSentCount(1);
    }
}
```

### Multiple Inheritance via `IntersectsHttp`

For test classes already extending another base (e.g. `WPDevTest\Woocommerce\Integration\TestCase` or `BaseAjaxTestCase`):

```php
class OrderSyncTest extends \WPDevTest\Woocommerce\Integration\TestCase {
    use \WPDevTest\Http\Traits\IntersectsHttp;

    // Both OrderBuilder and HttpMock work simultaneously without state leakage!
}
```

### Invariants & Features
- **Fail-Closed Guard**: `HttpMock::preventStrayRequests()` throws `StrayRequestException` on unmocked external requests.
- **Query-Normalized Matching**: `https://api.com/course?b=2&a=1` matches `https://api.com/course?a=1&b=2`.
- **Wildcard Path Matching**: `https://api.com/course/*` matches paths regardless of appended query strings.
- **RFC 7230 Headers**: `$request->header('Content-Type')`, `$request->header('content-type')`, `$request->header('CONTENT-TYPE')` resolve identically.
- **Sequential Responses**: `HttpMock::sequence()->push(...)->push(...)->whenEmpty(...)` for retry/polling flows.
- **Dot-Notation Access**: `$request->json('Data.user.id')`, `$request->query('filter.status')`.
- **Automatic Teardown Isolation**: `IntersectsHttp` runs `@after` / `tearDown()` resetting all mocks and filter hooks.


## Test authoring rules

| Rule | Practice |
|------|----------|
| Header | `declare(strict_types=1);` on every new test file |
| Discovery | `@test` on public methods (no `test*` prefix required) |
| Naming | `itShouldVerbExpectedOutcome()` |
| Assertions | Always pass a message: `$this->assertTrue( isset( $panel['something'] ), 'Admin Panel Was not Registered' );` |
| Helpers | `$this->method_working_notice($class, $method, $id)`, `$this->template_working_notice(...)` |
| Data | `@dataProvider` + provider methods — see [test-authoring-examples.md](references/test-authoring-examples.md) |
| Cleanup | DB auto-rollback; in `tearDown()` remove filters/actions, dequeue scripts, clear transients, and undo WooCommerce helper side effects (`Fee`, `Coupon`, `Shipping`, `Shipping_Zones`) — see [wc-core-test.md](references/wc-core-test.md) |
| Private API | `method_call()`, `property_set()`, `property_get()` — not raw Reflection; `method_call( …, true )` captures echo output |

Examples (dataProvider, admin `setUp`, tearDown, `expectFilter`): [test-authoring-examples.md](references/test-authoring-examples.md).

## Auth & URLs

```php
$user_id = $this->login( 'editor' );      // role slug: 'subscriber', 'administrator', 'editor', …
$this->switch_user( $other_user_id );     // needs user-switching in plugins-list.php

$this->go_to( get_permalink( $post_id ) ); // front-end / rewrite query (permalink structure set by go_to)
```

`login()` takes a **WordPress role slug**, passed straight to `user->create( [ 'role' => … ] )`. Never pass a capability:

```php
$this->login( 'administrator' );   // correct
$this->login( 'manage_options' );  // wrong — capability, not a role; creates a user with no role
```

Custom capabilities: register the role/cap **before** `login()`, then `flush_capabilities()`.

## Patterns (by topic)

| Topic | Reference |
|-------|-----------|
| Docker PHPUnit (PHP + MySQL in containers) | [docker-phpunit.md](docs/docker-phpunit.md) |
| Private packages (path repo) | [private-packages.md](references/private-packages.md) |
| composer, phpunit, bootstrap | [scaffolding.md](references/scaffolding.md) |
| Base classes & hierarchy | [test-base-classes.md](references/test-base-classes.md) |
| REST, Ajax, HTTP, admin screen, `go_to` | [patterns-rest-ajax-http.md](references/patterns-rest-ajax-http.md) |
| Core + custom factories | [factories.md](references/factories.md) |
| WooCommerce helpers (`wc-core-test`) | [wc-core-test.md](references/wc-core-test.md) |
| PHPUnit mocks, ObjectProxy | [mocking.md](references/mocking.md) |
| dataProvider, tearDown, expectFilter | [test-authoring-examples.md](references/test-authoring-examples.md) |
| Activation + shared FQCNs (`method_exists`) | [activation-shared-fqcn.md](references/activation-shared-fqcn.md) |

## Activation blind spot (read when hosts share packages)

Default unit suites **will not** catch activation fatals that only appear when:

1. Another active plugin already autoloaded an **older** copy of a shared FQCN (e.g. `WPDev\Support\Assets`), and
2. This plugin’s main file / late-boot path (after `plugins_loaded`) calls a **newer** method on that class during `plugin_sandbox_scrape` / `activate_plugin`.

Symptom: Activate fails with `Call to undefined method …`; bypass with early `return` then activate “works” on subsequent loads.

**Related — HTTP 503 / timeout on first Activate:** `activate_plugin()` → `plugin_sandbox_scrape()` includes the plugin after `plugins_loaded` has finished. A full embedded-framework boot in that request (modules + Action Scheduler + singleton) can exceed PHP-FPM/proxy limits; WordPress never writes `active_plugins`, so Activate appears to fail. Same early-`return` bypass “fixes” it because the next normal request boots cheaply. Mitigate with a `WP_SANDBOX_SCRAPING` light path (register cheap activation hooks, skip framework `require` until the following request). See host `ActivationBootstrap`.

**Mitigation in production:** `method_exists( $class, 'method' )` (not only `class_exists`) before calling evolving shared APIs. **Mitigation in tests:** fixture class without the new method + injectable class name on the wiring helper — see [activation-shared-fqcn.md](references/activation-shared-fqcn.md).

## Distribution Smoke Testing (Executable Bootstrap vs False Greens)

Distribution packages (`dist/{slug}.zip`) require dedicated smoke verification before shipping or deploying.

### The False-Green Pitfall
Checking only `test -f "$PLUGIN/file.php"` or `is_readable(...)` in smoke scripts generates dangerous **False Greens**:
- Files can exist on disk while containing broken class references, missing internal dependencies, or fatal syntax errors.
- On macOS, file requires with mismatched case (`Access` vs `access`) succeed silently because APFS is case-insensitive, but immediately crash with a Fatal Error on Linux production.
- If release packaging strips `packages/` but runtime packages were not moved to `dependencies/`, `test -f` passes while runtime calls fatal.

### Executable Smoke Test Pattern
A distribution smoke test script (e.g. `dev/release/smoke-standalone-zip.sh`) must:
1. Unpack `dist/{slug}.zip` to an isolated temporary directory (`mktemp -d`).
2. Verify basic directory structure (no `tests/`, `node_modules/`, or unstripped dev files).
3. **Execute the actual plugin bootstrap lifecycle** in an isolated PHP process (`php -r`) with minimal WordPress function stubs (`ABSPATH`, `plugin_dir_path()`, `apply_filters()`, `add_action()`, `did_action()`, `sanitize_key()`, `WP_List_Table`, etc.):

```bash
php -r '
$plugin = $argv[1];
define("ABSPATH", sys_get_temp_dir() . "/");
function plugin_dir_path($f) { return dirname($f) . "/"; }
function plugin_dir_url($f) { return "http://example.com/"; }
function plugin_basename($f) { return basename($f); }
function is_admin() { return true; }
function add_action() {}
function add_filter() {}
function apply_filters($t, $v) { return $v; }
function do_action() {}
function did_action($a) { return false; }
function sanitize_key($k) { return preg_replace("/[^a-z0-9_-]/", "", strtolower((string)$k)); }
function wp_parse_args($a, $b = array()) { return array_merge((array)$b, (array)$a); }
function get_option($k, $d = false) { return $d; }
class WP_List_Table {}

// Require plugin bootstrap or embedded framework entrypoint
require $plugin . "/src/bootstrap/wpdev-framework.php";

// Assert critical classes and functions are loaded without fatal errors
if (!class_exists("WPDev\\Access\\Exceptions\\Access_Denied_Exception")) {
  fwrite(STDERR, "Access_Denied_Exception class missing\n");
  exit(1);
}
echo "standalone_zip_ok\n";
' "$PLUGIN"
```

4. Fail the build with exit code `1` if any critical class, function, or constant is missing.
5. Wire this script directly into `run-release.js` so that a broken zip can never be generated or shipped.

## Agent checklist

When adding or fixing unit tests:

1. Set up `packages/` and path repo — [private-packages.md](references/private-packages.md).
2. Create missing scaffolding (`composer.json`, `phpunit.xml.dist` with `executionOrder="random"`, `bootstrap.php`; `plugins-list.php` only if needed).
3. Create `tests/unit-tests/TestCases/PluginBaseTestCase.php` if it does not exist — [test-base-classes.md](references/test-base-classes.md).
4. Place test file mirroring `src/` with correct namespace.
5. Extend the right base class (`PluginBaseTestCase` by default).
6. **TDD:** write/update the test first; run suite and confirm it **fails**; only then write production code until it **passes**.
7. Use `@test`, descriptive method name, assertion messages; keep tests order-independent.
8. Register custom factories on `WPDevTest/Factory` **in `bootstrap.php`** when domain data is needed — [factories.md](references/factories.md).
9. Roll back non-DB side effects in `tearDown()` (filters, enqueued scripts).
10. Run `composer tests` (random order) when env vars are configured — or `./run-phpunit.sh` from a [Docker PHPUnit env](docs/docker-phpunit.md) when MySQL is not on the host.

## Out of scope

- Acceptance / Behat (`tests/acceptance/`)
- Integration test suite (future skill)
- `createTestProxy` / BetterStudioTest
- `wpdev/wp-test-tools` (dependencies outside this skill)

**Bundled packages under `packages/`:** while writing tests for a plugin, treat them as read-only — never "improve" them from a consumer project. Skill maintainers may patch package bugs; those changes belong to this skill's own repository and are tracked in [improvement-plan.md](docs/improvement-plan.md).
