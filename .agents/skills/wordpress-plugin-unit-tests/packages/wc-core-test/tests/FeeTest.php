<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Fee;

class FeeTest extends UnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		if ( function_exists( 'WC' ) && isset( WC()->cart ) ) {
			WC()->cart->empty_cart();
		}
	}

	protected function tearDown(): void {
		Fee::remove_cart_fee();
		Fee::remove_cart_fee( 'taxed' );
		Fee::remove_cart_fee( 'negative' );
		Fee::remove_cart_fee( 'negative-taxed' );
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldCreateSimpleFeeOnCart(): void {
		Fee::create_simple_fee();

		$this->assertNotEmpty( WC()->cart->fees );
		$fee = WC()->cart->fees[0];
		$this->assertSame( 'Dummy Fee', $fee['name'] );
		$this->assertSame( 10, $fee['amount'] );
		$this->assertFalse( $fee['taxable'] );
	}

	/**
	 * @test
	 */
	public function itShouldCreateTaxedFeeOnCart(): void {
		Fee::create_taxed_fee();

		$fee = WC()->cart->fees[0];
		$this->assertSame( 'Dummy Taxed Fee', $fee['name'] );
		$this->assertSame( 10, $fee['amount'] );
		$this->assertTrue( $fee['taxable'] );
	}

	/**
	 * @test
	 */
	public function itShouldCreateNegativeFeeOnCart(): void {
		Fee::create_negative_fee();

		$fee = WC()->cart->fees[0];
		$this->assertSame( 'Dummy Negative Fee', $fee['name'] );
		$this->assertSame( -10, $fee['amount'] );
	}

	/**
	 * @test
	 */
	public function itShouldAddAndRemoveCartFeeActions(): void {
		Fee::add_cart_fee();
		$this->assertNotFalse( has_action( 'woocommerce_cart_calculate_fees' ) );

		Fee::remove_cart_fee();
		$this->assertFalse( has_action( 'woocommerce_cart_calculate_fees' ) );
	}
}
