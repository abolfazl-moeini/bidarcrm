<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Simulator\CartSimulator;

class CartSimulatorTest extends UnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		WC()->cart->empty_cart();
	}

	/**
	 * @test
	 */
	public function itShouldFluentConfigureCartAndAssertTotals(): void {
		$simulator = CartSimulator::new();
		$product   = new \WC_Product();

		$simulator
			->add( $product, 2 )
			->applyCoupon( 'DISCOUNT10' )
			->addFee( 'Express Handling', 5.0 )
			->setShippingMethod( 'flat_rate:1' )
			->calculateTotals();

		$this->assertSame( 100.0, $simulator->getSubtotal() );
		$this->assertSame( 100.0, $simulator->getTotal() );

		$simulator->assertTotal( 100.0 )
			->assertSubtotal( 100.0 )
			->assertItemCount( 2 );

		$this->assertSame( array( 'flat_rate:1' ), WC()->session->get( 'chosen_shipping_methods' ) );
	}

	/**
	 * @test
	 */
	public function itShouldEmptyCart(): void {
		$simulator = CartSimulator::new();
		$product   = new \WC_Product();

		$simulator->add( $product, 1 );
		$this->assertSame( 1, WC()->cart->get_cart_contents_count() );

		$simulator->empty();
		$simulator->assertItemCount( 0 );
	}
}
