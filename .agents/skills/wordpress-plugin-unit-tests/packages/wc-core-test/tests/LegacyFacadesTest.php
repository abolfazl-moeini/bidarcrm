<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Shipping_Zones;
use WPDevTest\Woocommerce\PaymentToken;
use WPDevTest\Woocommerce\Shipping;
use WPDevTest\Woocommerce\Settings;
use WPDevTest\Woocommerce\Coupon;
use WPDevTest\Woocommerce\Product;
use WPDevTest\Woocommerce\Order;
use WPDevTest\Woocommerce\State\HookGuard;

class LegacyFacadesTest extends UnitTestCase {

	protected function tearDown(): void {
		HookGuard::restore();
		Shipping::remove_forced_customer_us_address();
		Settings::unregister();
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldUseDeleteFromInsteadOfTruncateInShippingZones(): void {
		global $wpdb;
		$wpdb->queries = array();

		Shipping_Zones::remove_mock_zones();

		$this->assertNotEmpty( $wpdb->queries );
		foreach ( $wpdb->queries as $query ) {
			$this->assertStringNotContainsString( 'TRUNCATE', $query, 'TRUNCATE TABLE commits transactions and breaks isolation.' );
			$this->assertStringContainsString( 'DELETE FROM', $query );
		}
	}

	/**
	 * @test
	 */
	public function itShouldCreateMockShippingZones(): void {
		$zones = Shipping_Zones::create_mock_zones();
		$this->assertCount( 4, $zones );
	}

	/**
	 * @test
	 */
	public function itShouldCreatePaymentTokenWithFutureExpiryYear(): void {
		$token = PaymentToken::create_cc_token( 1 );

		$this->assertSame( '1234', $token->last4 );
		$this->assertGreaterThan( (int) gmdate( 'Y' ), (int) $token->expiry_year );
	}

	/**
	 * @test
	 */
	public function itShouldForceAndRemoveCustomerUsAddress(): void {
		Shipping::force_customer_us_address();

		$this->assertSame( 'US', apply_filters( 'woocommerce_customer_get_shipping_country', 'GB' ) );
		$this->assertSame( 'NY', apply_filters( 'woocommerce_customer_get_shipping_state', 'CA' ) );
		$this->assertSame( '12345', apply_filters( 'woocommerce_customer_get_shipping_postcode', '90210' ) );

		Shipping::remove_forced_customer_us_address();

		$this->assertSame( 'GB', apply_filters( 'woocommerce_customer_get_shipping_country', 'GB' ) );
	}

	/**
	 * @test
	 */
	public function itShouldRegisterAndUnregisterSettings(): void {
		Settings::register();
		$this->assertNotFalse( has_filter( 'woocommerce_settings_groups' ) );
		$this->assertNotFalse( has_filter( 'woocommerce_settings-test' ) );

		Settings::unregister();
		$this->assertFalse( has_filter( 'woocommerce_settings_groups' ) );
		$this->assertFalse( has_filter( 'woocommerce_settings-test' ) );
	}

	/**
	 * @test
	 */
	public function itShouldDelegateLegacyCouponCreation(): void {
		$coupon = Coupon::create_coupon( 'LEGACY10', array( 'coupon_amount' => 10.0 ) );

		$this->assertSame( 'LEGACY10', $coupon->get_code() );
		$this->assertSame( 10.0, $coupon->get_amount() );
	}

	/**
	 * @test
	 */
	public function itShouldRegisterAndUnregisterCustomCouponType(): void {
		Coupon::register_custom_type( 'special_custom' );
		$types = apply_filters( 'woocommerce_coupon_discount_types', array() );
		$this->assertArrayHasKey( 'special_custom', $types );

		Coupon::unregister_custom_type( 'special_custom' );
		$types_after = apply_filters( 'woocommerce_coupon_discount_types', array() );
		$this->assertArrayNotHasKey( 'special_custom', $types_after );
	}

	/**
	 * @test
	 */
	public function itShouldDelegateLegacyProductCreation(): void {
		$product = Product::create_simple_product( true, array( 'name' => 'Legacy Widget', 'regular_price' => 40.0 ) );

		$this->assertSame( 'Legacy Widget', $product->get_name() );
		$this->assertSame( 40.0, $product->get_price() );
	}

	/**
	 * @test
	 */
	public function itShouldDelegateLegacyOrderCreation(): void {
		$order = Order::create_order( 99 );

		$this->assertSame( 99, $order->customer_id );
		$this->assertSame( 'NY', $order->billing_address['state'] );
	}
}
