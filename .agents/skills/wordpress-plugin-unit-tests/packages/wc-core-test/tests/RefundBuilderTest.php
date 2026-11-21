<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\RefundBuilder;
use WPDevTest\Woocommerce\Builder\OrderBuilder;
use WC_Order_Refund;
use InvalidArgumentException;

class RefundBuilderTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldThrowExceptionWhenNoOrderProvided(): void {
		$this->expectException( InvalidArgumentException::class );
		$this->expectExceptionMessage( 'Cannot create a refund without an associated WC_Order.' );

		RefundBuilder::new()
			->amount( 25.0 )
			->create();
	}

	/**
	 * @test
	 */
	public function itShouldCreateRefundForOrder(): void {
		$order = OrderBuilder::new()->create();
		$order->total = 100.0;

		$refund = RefundBuilder::new()
			->forOrder( $order )
			->amount( 35.0 )
			->reason( 'Customer returned damaged goods' )
			->restock( true )
			->withLineItem( 101, 1, 35.0 )
			->create();

		$this->assertInstanceOf( WC_Order_Refund::class, $refund );
		$this->assertSame( 35.0, $refund->amount );
		$this->assertSame( 'Customer returned damaged goods', $refund->reason );
	}
}
