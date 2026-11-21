<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Assert;

use WC_Order;
use PHPUnit\Framework\Assert;

/**
 * Domain-specific assertions for WooCommerce orders.
 */
class OrderAssert {

	public static function assertOrderTotalEquals( float $expected, WC_Order $order, string $message = '' ): void {
		Assert::assertEqualsWithDelta(
			$expected,
			(float) $order->get_total(),
			0.001,
			'' !== $message ? $message : sprintf( 'Expected order total %.2f, but got %.2f', $expected, (float) $order->get_total() )
		);
	}

	public static function assertOrderStatusEquals( string $expected_status, WC_Order $order, string $message = '' ): void {
		$clean_expected = str_replace( 'wc-', '', $expected_status );
		$actual_status  = str_replace( 'wc-', '', $order->get_status() );

		Assert::assertSame(
			$clean_expected,
			$actual_status,
			'' !== $message ? $message : sprintf( 'Expected order status "%s", but got "%s"', $clean_expected, $actual_status )
		);
	}

	public static function assertOrderMetaEquals( $expected_value, string $meta_key, WC_Order $order, string $message = '' ): void {
		$actual_value = $order->get_meta( $meta_key );

		Assert::assertSame(
			$expected_value,
			$actual_value,
			'' !== $message ? $message : sprintf( 'Expected order meta "%s" to equal %s, but got %s', $meta_key, wp_json_encode( $expected_value ), wp_json_encode( $actual_value ) )
		);
	}

	public static function assertLineItemCount( int $expected_count, WC_Order $order, string $message = '' ): void {
		$actual_count = count( $order->get_items() );

		Assert::assertSame(
			$expected_count,
			$actual_count,
			'' !== $message ? $message : sprintf( 'Expected %d line items in order, but found %d', $expected_count, $actual_count )
		);
	}

	public static function assertOrderPaid( WC_Order $order, string $message = '' ): void {
		$is_paid = method_exists( $order, 'is_paid' )
			? $order->is_paid()
			: ( in_array( str_replace( 'wc-', '', $order->get_status() ), array( 'processing', 'completed' ), true ) || ( method_exists( $order, 'get_date_paid' ) && null !== $order->get_date_paid() ) );

		Assert::assertTrue(
			$is_paid,
			'' !== $message ? $message : sprintf( 'Expected order #%d to be paid, but got status "%s"', $order->get_id(), $order->get_status() )
		);
	}

	public static function assertOrderNotPaid( WC_Order $order, string $message = '' ): void {
		$is_paid = method_exists( $order, 'is_paid' )
			? $order->is_paid()
			: ( in_array( str_replace( 'wc-', '', $order->get_status() ), array( 'processing', 'completed' ), true ) || ( method_exists( $order, 'get_date_paid' ) && null !== $order->get_date_paid() ) );

		Assert::assertFalse(
			$is_paid,
			'' !== $message ? $message : sprintf( 'Expected order #%d not to be paid, but it was marked paid', $order->get_id() )
		);
	}

	public static function assertCustomerEquals( int $expected_customer_id, WC_Order $order, string $message = '' ): void {
		$actual = (int) ( method_exists( $order, 'get_customer_id' ) ? $order->get_customer_id() : ( $order->customer_id ?? 0 ) );
		Assert::assertSame(
			$expected_customer_id,
			$actual,
			'' !== $message ? $message : sprintf( 'Expected customer ID %d, but got %d', $expected_customer_id, $actual )
		);
	}
}
