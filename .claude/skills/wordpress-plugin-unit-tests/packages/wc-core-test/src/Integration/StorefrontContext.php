<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Integration;

/**
 * Boots and manages authentic WooCommerce Storefront state (Session, Cart, Customer) during integration tests.
 */
class StorefrontContext {

	/**
	 * Boot active customer session, cart, and storefront context.
	 *
	 * Prevents "Call to a member function get() on null" when accessing WC()->session or WC()->cart.
	 *
	 * @return void
	 */
	public static function boot(): void {
		if ( ! function_exists( 'WC' ) ) {
			return;
		}
		try {
			$wc = WC();
		} catch ( \Throwable $e ) {
			return;
		}
		if ( ! is_object( $wc ) ) {
			return;
		}

		// 1. Initialize session handler if missing
		if ( ! isset( $wc->session ) || null === $wc->session ) {
			if ( class_exists( 'WC_Mock_Session_Handler' ) ) {
				$wc->session = new \WC_Mock_Session_Handler();
			} elseif ( class_exists( 'WC_Session_Handler' ) ) {
				$wc->session = new \WC_Session_Handler();
				$wc->session->init();
			}
		}

		// 2. Initialize customer if missing
		if ( ! isset( $wc->customer ) || null === $wc->customer ) {
			if ( class_exists( 'WC_Customer' ) ) {
				$wc->customer = new \WC_Customer( 0, true );
			}
		}

		// 3. Load cart if missing
		if ( ! isset( $wc->cart ) || null === $wc->cart ) {
			if ( function_exists( 'wc_load_cart' ) ) {
				wc_load_cart();
			} elseif ( class_exists( 'WC_Cart' ) ) {
				$wc->cart = new \WC_Cart();
			}
		}
	}
}
