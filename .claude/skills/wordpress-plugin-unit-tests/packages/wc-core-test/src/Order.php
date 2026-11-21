<?php

namespace WPDevTest\Woocommerce;
/**
 * Order helpers.
 *
 * @package WPDevTest\Woocommerce
 */

use WC_Order_Item_Product, WC_Order_Item_Shipping,WC_Order_Item_Fee;
use WC_Shipping_Rate, WC_Tax;
use WC_Order, WC_Product;

/**
 * Class WC_Helper_Order.
 *
 * This helper class should ONLY be used for unit tests!.
 */
class Order {

	/**
	 * Delete an order.
	 *
	 * @param int  $order_id        ID of the order to delete.
	 * @param bool $delete_products Whether to delete order products (default false to prevent catalog corruption).
	 */
	public static function delete_order( $order_id, bool $delete_products = false ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		if ( $delete_products ) {
			foreach ( $order->get_items() as $item ) {
				$product_id = is_object( $item ) && method_exists( $item, 'get_product_id' )
					? $item->get_product_id()
					: ( $item['product_id'] ?? 0 );
				if ( $product_id > 0 ) {
					Product::delete_product( $product_id );
				}
			}
		}

		// Delete the order object (works for both HPOS and CPT)
		$order->delete( true );
	}


	/**
	 * @param int   $numbers
	 * @param mixed ...$args
	 *
	 * @return WC_Order[]
	 */
	public static function create_order_many( int $numbers, ...$args ) {

		$orders = [];

		for ( $i = 0; $i < $numbers; $i ++ ) {

			$orders[] = self::create_order( ...$args );
		}

		return $orders;
	}

	/**
	 * Create a order (legacy facade delegating to OrderBuilder).
	 *
	 * @param int        $customer_id The ID of the customer the order is for.
	 * @param WC_Product $product     The product to add to the order.
	 *
	 * @since   2.4
	 * @return WC_Order
	 * @version 3.0 New parameter $product.
	 */
	public static function create_order( $customer_id = 1, $product = null ) {
		$builder = \WPDevTest\Woocommerce\Builder\OrderBuilder::new()
			->withCustomer( $customer_id );

		if ( is_a( $product, 'WC_Product' ) ) {
			$builder->withItem( $product, 4 );
		} else {
			$prod = Product::create_simple_product();
			$builder->withItem( $prod, 4 );
		}

		$builder->withShipping( 'flat_rate_shipping', 10.0, 'Flat rate shipping' );
		$builder->withPaymentMethod( 'bacs', 'Direct bank transfer' );
		$builder->withBillingAddress(
			array(
				'first_name' => 'Jeroen',
				'last_name'  => 'Sormani',
				'company'    => 'WooCompany',
				'address_1'  => 'WooAddress',
				'city'       => 'WooCity',
				'state'      => 'NY',
				'postcode'   => '12345',
				'country'    => 'US',
				'email'      => 'admin@example.org',
				'phone'      => '555-32123',
			)
		);

		return $builder->create();
	}

	/**
	 * Helper function to create order with fees and shipping objects.
	 *
	 * @param int        $customer_id The ID of the customer the order is for.
	 * @param WC_Product $product     The product to add to the order.
	 *
	 * @return WC_Order
	 */
	public static function create_order_with_fees_and_shipping( $customer_id = 1, $product = null ) {
		$order = self::create_order( $customer_id, $product );

		$fee_item = new WC_Order_Item_Fee();
		$fee_item->set_order_id( $order->get_id() );
		$fee_item->set_name( 'Testing fees' );
		$fee_item->set_total( 100 );

		$shipping_item = new WC_Order_Item_Shipping();
		$shipping_item->set_order_id( $order->get_id() );
		$shipping_item->set_name( 'Flat shipping' );
		$shipping_item->set_total( 25 );

		$order->add_item( $fee_item );
		$order->add_item( $shipping_item );
		$order->save();
		$order->calculate_totals( true );

		return $order;
	}
}
