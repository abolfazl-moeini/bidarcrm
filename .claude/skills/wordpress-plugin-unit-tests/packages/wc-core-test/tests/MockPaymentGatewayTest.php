<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Mock\MockPaymentGateway;
use WPDevTest\Woocommerce\State\HookGuard;

class MockPaymentGatewayTest extends UnitTestCase {

	protected function tearDown(): void {
		HookGuard::restore();
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldConfigureGatewayProperties(): void {
		$gateway = new MockPaymentGateway( 'custom_gateway', 'Custom Gateway Title' );

		$this->assertSame( 'custom_gateway', $gateway->id );
		$this->assertSame( 'Custom Gateway Title', $gateway->title );
		$this->assertSame( 'yes', $gateway->enabled );
		$this->assertContains( 'refunds', $gateway->supports );
	}

	/**
	 * @test
	 */
	public function itShouldConfigureSuccessFailureAndRedirectStates(): void {
		$gateway = new MockPaymentGateway();

		$gateway->willFail( 'Custom error message' );
		// Verify fluent return
		$this->assertSame( $gateway, $gateway->willSucceed( 'custom_txn_456' ) );
		$this->assertSame( $gateway, $gateway->willRedirect( 'https://example.test/checkout/pay' ) );
	}

	/**
	 * @test
	 */
	public function itShouldConfigureRefundSupport(): void {
		$gateway = new MockPaymentGateway();

		$gateway->supportsRefunds( false );
		$this->assertNotContains( 'refunds', $gateway->supports );

		$gateway->supportsRefunds( true );
		$this->assertContains( 'refunds', $gateway->supports );

		$gateway->willRefundSucceed( false );
		$this->assertFalse( $gateway->process_refund( 123 ) );

		$gateway->willRefundSucceed( true );
		$this->assertTrue( $gateway->process_refund( 123 ) );
	}

	/**
	 * @test
	 */
	public function itShouldRegisterIntoPaymentGatewaysFilter(): void {
		$gateway = MockPaymentGateway::register( 'test_reg_gw', 'Registered GW' );

		$this->assertInstanceOf( MockPaymentGateway::class, $gateway );
		$this->assertNotFalse( has_filter( 'woocommerce_payment_gateways' ) );

		HookGuard::restore();
		$this->assertFalse( has_filter( 'woocommerce_payment_gateways' ) );
	}
}
