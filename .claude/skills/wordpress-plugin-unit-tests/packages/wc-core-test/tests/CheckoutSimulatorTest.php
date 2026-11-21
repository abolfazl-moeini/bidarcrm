<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Simulator\CheckoutSimulator;
use WPDevTest\Woocommerce\Builder\ProductBuilder;
use WPDevTest\Woocommerce\Builder\CustomerBuilder;
use WC_Order;

class CheckoutSimulatorTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldExecuteCheckoutSimulationEndToEndInThreeLines(): void {
		$product  = ProductBuilder::new()->priced( 45.0 )->create();
		$customer = CustomerBuilder::new()->named( 'Bob', 'Smith' )->create();

		$order = CheckoutSimulator::new()
			->withProduct( $product, 2 )
			->withCoupon( 'SAVE10' )
			->withPaymentMethod( 'bacs' )
			->withCustomer( $customer )
			->processCheckout();

		$this->assertInstanceOf( WC_Order::class, $order );
		$this->assertSame( 'processing', $order->get_status() );
	}

	/**
	 * @test
	 */
	public function itShouldAcceptDirectBillingAndShippingArrays(): void {
		$product = ProductBuilder::new()->priced( 20.0 )->create();

		$order = CheckoutSimulator::new()
			->withProduct( $product, 1 )
			->withBilling(
				array(
					'first_name' => 'Direct',
					'city'       => 'Chicago',
				)
			)
			->withShipping(
				array(
					'first_name' => 'Direct',
					'city'       => 'Chicago',
				)
			)
			->processCheckout();

		$this->assertInstanceOf( WC_Order::class, $order );
	}

	/**
	 * @test
	 */
	public function itShouldRestorePostSuperglobalEvenIfExceptionOccurs(): void {
		$_POST['preset_key'] = 'original_value';

		$checkout = \WC_Checkout::instance();
		$original_fn = function () {
			throw new \RuntimeException( 'Simulated checkout failure.' );
		};

		// Mock failure in process_checkout
		add_filter( 'woocommerce_checkout_order_processed', $original_fn );

		try {
			CheckoutSimulator::new()->processCheckout();
		} catch ( \Throwable $e ) {
			// Caught expected failure
		} finally {
			remove_filter( 'woocommerce_checkout_order_processed', $original_fn );
		}

		$this->assertSame( 'original_value', $_POST['preset_key'] ?? null, 'Original $_POST must be restored.' );
	}
}
