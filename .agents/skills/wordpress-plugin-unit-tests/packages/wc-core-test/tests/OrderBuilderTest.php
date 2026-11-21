<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\OrderBuilder;
use WPDevTest\Woocommerce\Builder\ProductBuilder;
use WC_Order;

class OrderBuilderTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldCreateMinimalOneWriteOrder(): void {
		$order = OrderBuilder::new()
			->withCustomer( 5 )
			->withStatus( 'pending' )
			->create();

		$this->assertInstanceOf( WC_Order::class, $order );
		$this->assertSame( 5, $order->customer_id );
		$this->assertSame( 'pending', $order->get_status() );
	}

	/**
	 * @test
	 */
	public function itShouldCreateOrderWithPaidStateWithoutFiringCompleteHooks(): void {
		$order = OrderBuilder::new()
			->withCustomer( 12 )
			->asPaidState()
			->create();

		$this->assertSame( 'processing', $order->get_status() );
		$this->assertNotNull( $order->date_paid );
	}

	/**
	 * @test
	 */
	public function itShouldCreateComplexOrderWithItemsShippingFeesAndCoupons(): void {
		$product = ProductBuilder::new()->priced( 25.0 )->create();

		$order = OrderBuilder::new()
			->withCustomer( 7 )
			->withItem( $product, 2, 25.0 )
			->withShipping( 'flat_rate', 10.0, 'Standard Shipping' )
			->withFee( 'Gift Wrap', 5.0 )
			->withCoupon( 'DISCOUNT10', 10.0 )
			->withBillingAddress(
				array(
					'first_name' => 'Alice',
					'country'    => 'US',
				)
			)
			->withPaymentMethod( 'bacs', 'Direct Bank Transfer' )
			->withMeta( '_custom_order_ref', 'REF-999' )
			->create();

		$this->assertSame( 7, $order->customer_id );
		$this->assertSame( 'REF-999', $order->get_meta( '_custom_order_ref' ) );
		$this->assertSame( 'bacs', $order->payment_method );
		$this->assertSame( 'Alice', $order->billing_address['first_name'] );
		$this->assertSame( 10.0, $order->shipping_total );
		$this->assertCount( 4, $order->get_items() ); // product, shipping, fee, coupon
	}

	/**
	 * @test
	 */
	public function itShouldExecutePaymentCompletedPipeline(): void {
		$order = OrderBuilder::new()
			->withCustomer( 8 )
			->paymentCompleted( 'txn_live_complete_123' )
			->create();

		$this->assertSame( 'processing', $order->get_status() );
		$this->assertSame( 'txn_live_complete_123', $order->get_meta( '_transaction_id' ) );
	}
}
