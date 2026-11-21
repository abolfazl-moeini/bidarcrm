<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Simulator;

use WC_Order;
use WC_Product;
use WC_Customer;
use WPDevTest\Woocommerce\Integration\StorefrontContext;

/**
 * Simulates WooCommerce checkout processing end-to-end in 3 lines of test code.
 */
class CheckoutSimulator {

	protected CartSimulator $cart;
	protected string $payment_method = 'bacs';
	protected array $billing = array();
	protected array $shipping = array();

	public function __construct() {
		StorefrontContext::boot();
		$this->cart = new CartSimulator();
		$this->cart->empty();
	}

	public static function new(): self {
		return new self();
	}

	public function withProduct( WC_Product $product, int $qty = 1 ): self {
		$this->cart->add( $product, $qty );
		return $this;
	}

	public function withCoupon( string $code ): self {
		$this->cart->applyCoupon( $code );
		return $this;
	}

	public function withPaymentMethod( string $method_id ): self {
		$this->payment_method = $method_id;
		return $this;
	}

	public function withCustomer( WC_Customer $customer ): self {
		$this->billing = array(
			'first_name' => $customer->get_billing_first_name(),
			'last_name'  => $customer->get_billing_last_name(),
			'email'      => $customer->get_billing_email(),
			'phone'      => $customer->get_billing_phone(),
			'address_1'  => $customer->get_billing_address_1(),
			'city'       => $customer->get_billing_city(),
			'state'      => $customer->get_billing_state(),
			'postcode'   => $customer->get_billing_postcode(),
			'country'    => $customer->get_billing_country(),
		);
		return $this;
	}

	public function withBilling( array $billing ): self {
		$this->billing = array_merge( $this->billing, $billing );
		return $this;
	}

	public function withShipping( array $shipping ): self {
		$this->shipping = array_merge( $this->shipping, $shipping );
		return $this;
	}

	/**
	 * Execute checkout and return the created WC_Order.
	 *
	 * @return WC_Order
	 */
	public function processCheckout(): WC_Order {
		$this->cart->calculateTotals();

		$default_billing = array(
			'billing_first_name' => 'John',
			'billing_last_name'  => 'Doe',
			'billing_email'      => 'john.doe@example.test',
			'billing_phone'      => '555-0199',
			'billing_address_1'  => '123 Main St',
			'billing_city'       => 'Austin',
			'billing_state'      => 'TX',
			'billing_postcode'   => '78701',
			'billing_country'    => 'US',
		);

		foreach ( $this->billing as $key => $val ) {
			$clean_key                      = 0 === strpos( $key, 'billing_' ) ? $key : 'billing_' . $key;
			$default_billing[ $clean_key ] = $val;
		}

		$post_data = array_merge(
			$default_billing,
			array(
				'payment_method' => $this->payment_method,
				'terms'          => 1,
			)
		);

		$created_order_id = 0;
		$capture_order_cb = function ( $order_id ) use ( &$created_order_id ) {
			$created_order_id = $order_id;
		};

		add_action( 'woocommerce_checkout_order_processed', $capture_order_cb, 10, 1 );

		// Execute checkout pipeline with exception safety
		$original_post = $_POST;
		try {
			$_POST = $post_data;

			$wc = function_exists( 'WC' ) ? WC() : null;
			if ( ! is_object( $wc ) || ! method_exists( $wc, 'checkout' ) ) {
				throw new \RuntimeException( 'CheckoutSimulator requires an initialized WC()->checkout(). Ensure WooCommerce is booted (Integration\\TestCase boots StorefrontContext).' );
			}
			$checkout = $wc->checkout();
			if ( ! is_object( $checkout ) || ! method_exists( $checkout, 'process_checkout' ) ) {
				throw new \RuntimeException( 'CheckoutSimulator requires WC_Checkout::process_checkout().' );
			}
			$checkout->process_checkout();
		} finally {
			$_POST = $original_post;
			remove_action( 'woocommerce_checkout_order_processed', $capture_order_cb, 10 );
		}

		if ( $created_order_id <= 0 ) {
			$notices_str = function_exists( 'wc_get_notices' ) && function_exists( 'wp_json_encode' )
				? (string) wp_json_encode( wc_get_notices() )
				: '';
			throw new \RuntimeException( 'Checkout simulation failed to create an order. Notices: ' . $notices_str );
		}

		return wc_get_order( $created_order_id );
	}
}
