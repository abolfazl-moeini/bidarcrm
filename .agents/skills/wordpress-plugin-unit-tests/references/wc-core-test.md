# WooCommerce Test Framework (`wpdev/wc-core-test` v2.0)

Universal test framework and fixture library for WooCommerce plugins and extensions. Namespace: `WPDevTest\Woocommerce\`.

**Required configuration:**
1. `woocommerce/woocommerce.php` in `tests/plugins-list.php`
2. `<env name="ACTIVE_PLUGINS" value="tests/plugins-list.php"/>` in `phpunit.xml.dist`
3. `"wpdev/wc-core-test": "^2.0"` in `require-dev`

---

## The 12 Testing Domains & Core APIs

### 1. Orders & HPOS (`OrderBuilder` & `DatastoreMatrix`)
Minimal 1-write order creation by default (Rung 2 of Fixture Ladder):
```php
use WPDevTest\Woocommerce\Builder\OrderBuilder;
use WPDevTest\Woocommerce\Integration\Datastore\DatastoreMatrix;

// 1-write lightweight order for permission/metadata tests
$order = OrderBuilder::new()
    ->withCustomer( $user_id )
    ->withStatus( 'processing' )
    ->asPaidState()
    ->create();

// Full complex order with line items, shipping, fees, and coupons
$order = OrderBuilder::new()
    ->withCustomer( $user_id )
    ->withItem( $product, 2 )
    ->withShipping( 'flat_rate', 15.0 )
    ->withCoupon( 'DISCOUNT10', 5.0 )
    ->paymentCompleted( 'txn_live_999' )
    ->create();

// Switch between HPOS and Legacy CPT
DatastoreMatrix::switch_to( DatastoreMatrix::HPOS_AUTHORITATIVE );
DatastoreMatrix::switch_to( DatastoreMatrix::LEGACY_CPT );
```

### 2. Products (`ProductBuilder`)
Single-save creation for all product types:
```php
use WPDevTest\Woocommerce\Builder\ProductBuilder;

$product = ProductBuilder::new()
    ->named( 'Premium Subscription' )
    ->priced( 99.0, 79.0 )
    ->sku( 'SUB-01' )
    ->inStock( 50, true )
    ->create();
```

### 3. Coupons (`CouponBuilder`)
Modern `WC_Coupon` CRUD data store creation:
```php
use WPDevTest\Woocommerce\Builder\CouponBuilder;

$coupon = CouponBuilder::new()
    ->code( 'SAVE20' )
    ->percent( 20.0 )
    ->minimumSpend( 50.0 )
    ->freeShipping()
    ->create();
```

### 4. Cart & Checkout Simulation (`CartSimulator` & `CheckoutSimulator`)
End-to-end checkout processing in 3 lines of code:
```php
use WPDevTest\Woocommerce\Simulator\CheckoutSimulator;

$order = CheckoutSimulator::new()
    ->withProduct( $product, 2 )
    ->withCoupon( 'SAVE20' )
    ->withPaymentMethod( 'bacs' )
    ->processCheckout();

$this->assertSame( 'processing', $order->get_status() );
```

### 5. Payment Gateways (`MockPaymentGateway`)
Configurable mock gateway for simulating gateway success, failure, redirects, and refunds:
```php
use WPDevTest\Woocommerce\Mock\MockPaymentGateway;

$gateway = MockPaymentGateway::register( 'test_gateway' )
    ->willSucceed( 'txn_live_123' );

$result = $gateway->process_payment( $order->get_id() );
$this->assertSame( 'success', $result['result'] );
```

### 6. Action Scheduler (`ActionSchedulerSpy`)
Inspect and execute asynchronous queue tasks synchronously in the same test process:
```php
use WPDevTest\Woocommerce\Spy\ActionSchedulerSpy;

ActionSchedulerSpy::assertActionScheduled( 'my_plugin_sync_action', array( $order->get_id() ) );
$processed = ActionSchedulerSpy::runDueActions(); // Runs due actions immediately
```

### 7. Store API / Blocks (`StoreApiRequest`)
Fast in-memory Store API dispatching via `rest_do_request()` (sub-50ms, zero external HTTP):
```php
use WPDevTest\Woocommerce\Spy\StoreApiRequest;

$response = StoreApiRequest::post( '/wc/store/v1/cart/add-item', array(
    'id'       => $product->get_id(),
    'quantity' => 1,
) );
$this->assertSame( 200, $response->get_status() );
```

### 8. Order Refunds (`RefundBuilder`)
Partial or full refunds with automated restocking:
```php
use WPDevTest\Woocommerce\Builder\RefundBuilder;

$refund = RefundBuilder::new()
    ->forOrder( $order )
    ->amount( 25.0 )
    ->reason( 'Customer request' )
    ->restock()
    ->create();
```

### 9. Taxes (`TaxRateBuilder`)
Creates tax rates and compound taxes with automated teardown:
```php
use WPDevTest\Woocommerce\Builder\TaxRateBuilder;

$rate_id = TaxRateBuilder::new()
    ->forCountry( 'US', 'CA' )
    ->withRate( 8.25 )
    ->create();
```

### 10. Shipping (`ShippingZoneBuilder` & `MockShippingMethod`)
Zones and dynamic methods with zero TRUNCATE:
```php
use WPDevTest\Woocommerce\Builder\ShippingZoneBuilder;

$zone = ShippingZoneBuilder::new()
    ->named( 'California Zone' )
    ->withLocation( 'US:CA', 'state' )
    ->withMethod( 'flat_rate' )
    ->create();
```

### 11. Emails & Logging (`EmailSpy` & `LoggerSpy`)
In-memory interception without disk writes:
```php
use WPDevTest\Woocommerce\Spy\EmailSpy;
use WPDevTest\Woocommerce\Spy\LoggerSpy;

EmailSpy::start();
// trigger action...
EmailSpy::assertEmailSent( 'customer@example.test', 'Your order is complete' );
```

### 12. Boundary Seeding (`OrderRowSeeder`)
Direct SQL insertion for high-volume analytics/reporting tests (Rung 3 of Fixture Ladder):
```php
use WPDevTest\Woocommerce\Seed\OrderRowSeeder;

$order_id = OrderRowSeeder::new()
    ->withStatus( 'completed' )
    ->withTotal( 150.0 )
    ->insert();
```

---

## Base Test Cases & State Isolation

Always extend `WPDevTest\Woocommerce\Integration\TestCase` for database-backed tests:
```php
use WPDevTest\Woocommerce\Integration\TestCase;

class MyPluginOrderTest extends TestCase {
    // try/finally teardown automatically executes:
    // 1. WooStateResetter::reset() (empties cart, clears session & notices)
    // 2. ResourceRegistry::cleanup() (deletes zones, tax rates via DELETE FROM)
    // 3. HookGuard::restore() (restores modified filters)
    // 4. parent::tearDown() (rolls back MySQL transaction)
}
```

For pure in-memory unit tests (services, calculators) without MySQL, extend:
```php
use WPDevTest\Woocommerce\Unit\UnitTestCase;
```

---

## Critical Rules

1. **Zero TRUNCATE**: Never use `TRUNCATE TABLE`. `Shipping_Zones` uses safe `DELETE FROM` to preserve MySQL transactions.
2. **Never Assert Literal Auto-Increment IDs**: `DELETE FROM` preserves `AUTO_INCREMENT` counters. Always assert `$entity->get_id() === $expected_id` rather than hardcoding `1`.
3. **Legacy Facades**: Old static calls (`Product::create_simple_product()`, `Order::create_order()`, `Coupon::create_coupon()`) remain 100% backward compatible and delegate to v2 Builders.
