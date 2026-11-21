<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Assert\OrderAssert;

class OrderAssertTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldAssertOrderTotalEquals(): void {
		$order = new \WC_Order();
		$order->total = 150.75;
		OrderAssert::assertOrderTotalEquals( 150.75, $order );
	}

	/**
	 * @test
	 */
	public function itShouldAssertOrderStatusEqualsWithOrWithoutPrefix(): void {
		$order = new \WC_Order();
		$order->set_status( 'completed' );
		OrderAssert::assertOrderStatusEquals( 'completed', $order );
		OrderAssert::assertOrderStatusEquals( 'wc-completed', $order );
	}

	/**
	 * @test
	 */
	public function itShouldAssertOrderMetaEquals(): void {
		$order = new \WC_Order();
		$order->update_meta_data( '_test_meta', 'hello' );
		OrderAssert::assertOrderMetaEquals( 'hello', '_test_meta', $order );
	}

	/**
	 * @test
	 */
	public function itShouldAssertLineItemCount(): void {
		$order = new \WC_Order();
		$order->add_item( new \WC_Order_Item_Product() );
		$order->add_item( new \WC_Order_Item_Product() );
		OrderAssert::assertLineItemCount( 2, $order );
	}

	/**
	 * @test
	 */
	public function itShouldAssertOrderPaidAndNotPaid(): void {
		$pending_order = new \WC_Order();
		$pending_order->set_status( 'pending' );
		OrderAssert::assertOrderNotPaid( $pending_order );

		$paid_order = new \WC_Order();
		$paid_order->set_status( 'processing' );
		OrderAssert::assertOrderPaid( $paid_order );

		$completed_order = new \WC_Order();
		$completed_order->set_status( 'completed' );
		OrderAssert::assertOrderPaid( $completed_order );
	}

	/**
	 * @test
	 */
	public function itShouldAssertCustomerEquals(): void {
		$order = new \WC_Order();
		$order->customer_id = 99;
		OrderAssert::assertCustomerEquals( 99, $order );
	}
}
