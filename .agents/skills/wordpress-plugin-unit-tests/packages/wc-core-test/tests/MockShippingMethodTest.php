<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Mock\MockShippingMethod;
use WPDevTest\Woocommerce\State\HookGuard;

class MockShippingMethodTest extends UnitTestCase {

	protected function tearDown(): void {
		HookGuard::restore();
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldConfigureShippingMethodProperties(): void {
		$method = new MockShippingMethod( 2 );

		$this->assertSame( 'mock_shipping', $method->id );
		$this->assertSame( 2, $method->instance_id );
		$this->assertSame( 'yes', $method->enabled );

		$method->setCost( 25.50 );
		$method->calculate_shipping( array( 'contents' => array() ) );
		$this->assertSame( 25.50, $method->getCost() );
	}

	/**
	 * @test
	 */
	public function itShouldRegisterIntoShippingMethodsFilter(): void {
		MockShippingMethod::register();

		$this->assertNotFalse( has_filter( 'woocommerce_shipping_methods' ) );

		HookGuard::restore();
		$this->assertFalse( has_filter( 'woocommerce_shipping_methods' ) );
	}
}
