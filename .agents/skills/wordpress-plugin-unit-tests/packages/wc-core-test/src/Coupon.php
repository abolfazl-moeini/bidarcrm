<?php

namespace WPDevTest\Woocommerce;

use WC_Coupon;

/**
 * Class WC_Helper_Product.
 *
 * This helper class should ONLY be used for unit tests!.
 *
 * @package WPDevTest\Woocommerce
 */
class Coupon {

	protected static $custom_types = array();
	protected static bool $filters_added = false;

	/**
	 * Create a dummy coupon.
	 *
	 * @param string $coupon_code
	 * @param array  $meta
	 *
	 * @return WC_Coupon
	 */
	public static function create_coupon( $coupon_code = 'dummycoupon', $meta = array() ) {
		$builder = \WPDevTest\Woocommerce\Builder\CouponBuilder::new()->code( $coupon_code );

		if ( isset( $meta['coupon_amount'] ) ) {
			$builder->amount( (float) $meta['coupon_amount'] );
		}
		if ( isset( $meta['discount_type'] ) ) {
			$builder->discountType( (string) $meta['discount_type'] );
		}
		if ( isset( $meta['free_shipping'] ) && 'yes' === $meta['free_shipping'] ) {
			$builder->freeShipping( true );
		}

		foreach ( $meta as $k => $v ) {
			if ( ! in_array( $k, array( 'coupon_amount', 'discount_type', 'free_shipping' ), true ) ) {
				$builder->withMeta( $k, $v );
			}
		}

		return $builder->create();
	}

	/**
	 * Delete a coupon.
	 *
	 * @param int|WC_Coupon $coupon_id
	 *
	 * @return bool
	 */
	public static function delete_coupon( $coupon_id ) {
		$coupon = is_a( $coupon_id, 'WC_Coupon' ) ? $coupon_id : new WC_Coupon( $coupon_id );
		if ( $coupon->get_id() > 0 ) {
			$coupon->delete( true );
		} else {
			wp_delete_post( (int) $coupon_id, true );
		}

		return true;
	}

	/**
	 * Register a custom coupon type.
	 *
	 * @param string $coupon_type
	 */
	public static function register_custom_type( $coupon_type ) {
		if ( isset( self::$custom_types[ $coupon_type ] ) ) {
			return;
		}

		self::$custom_types[ $coupon_type ] = "Testing custom type {$coupon_type}";

		if ( ! self::$filters_added ) {
			add_filter( 'woocommerce_coupon_discount_types', array( __CLASS__, 'filter_discount_types' ) );
			add_filter( 'woocommerce_coupon_get_discount_amount', array( __CLASS__, 'filter_get_discount_amount' ), 10, 5 );
			add_filter( 'woocommerce_coupon_is_valid_for_product', '__return_true' );
			self::$filters_added = true;
		}
	}

	/**
	 * Unregister custom coupon type.
	 *
	 * @param $coupon_type
	 */
	public static function unregister_custom_type( $coupon_type ) {
		unset( self::$custom_types[ $coupon_type ] );
		if ( empty( self::$custom_types ) ) {
			remove_filter( 'woocommerce_coupon_discount_types', array( __CLASS__, 'filter_discount_types' ) );
			remove_filter( 'woocommerce_coupon_get_discount_amount', array( __CLASS__, 'filter_get_discount_amount' ) );
			remove_filter( 'woocommerce_coupon_is_valid_for_product', '__return_true' );
			self::$filters_added = false;
		}
	}

	/**
	 * Register custom discount types.
	 *
	 * @param array $discount_types
	 * @return array
	 */
	public static function filter_discount_types( $discount_types ) {
		return array_merge( $discount_types, self::$custom_types );
	}

	/**
	 * Get custom discount type amount. Works like 'percent' type.
	 *
	 * @param float      $discount
	 * @param float      $discounting_amount
	 * @param array|null $item
	 * @param bool       $single
	 * @param WC_Coupon  $coupon
	 *
	 * @return float
	 */
	public static function filter_get_discount_amount( $discount, $discounting_amount, $item, $single, $coupon ) {
		if ( ! isset( self::$custom_types [ $coupon->get_discount_type() ] ) ) {
			return $discount;
		}

		return (float) $coupon->get_amount() * ( $discounting_amount / 100 );
	}
}
