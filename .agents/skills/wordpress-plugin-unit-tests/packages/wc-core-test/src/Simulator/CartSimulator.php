<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Simulator;

use WC_Product;
use PHPUnit\Framework\Assert;
use WPDevTest\Woocommerce\Integration\StorefrontContext;

/**
 * Fluent simulator for configuring, calculating, and asserting WooCommerce cart state.
 */
class CartSimulator {

	public function __construct() {
		StorefrontContext::boot();
	}

	public static function new(): self {
		return new self();
	}

	public function add( WC_Product $product, int $qty = 1 ): self {
		$this->cart_or_fail()->add_to_cart( $product->get_id(), $qty );
		return $this;
	}

	public function applyCoupon( string $code ): self {
		$this->cart_or_fail()->apply_coupon( $code );
		return $this;
	}

	public function addFee( string $name, float $amount, bool $taxable = false ): self {
		$this->cart_or_fail()->add_fee( $name, $amount, $taxable );
		return $this;
	}

	public function setShippingMethod( string $rate_id ): self {
		$wc = function_exists( 'WC' ) ? WC() : null;
		if ( ! is_object( $wc ) || ! isset( $wc->session ) || ! is_object( $wc->session ) ) {
			throw new \RuntimeException( 'CartSimulator requires an initialized WC()->session to set the shipping method.' );
		}
		$wc->session->set( 'chosen_shipping_methods', array( $rate_id ) );
		return $this;
	}

	public function calculateTotals(): self {
		$this->cart_or_fail()->calculate_totals();
		return $this;
	}

	public function getTotal(): float {
		return (float) $this->cart_or_fail()->get_total( 'edit' );
	}

	public function getSubtotal(): float {
		return (float) $this->cart_or_fail()->get_subtotal();
	}

	public function getTaxTotal(): float {
		return (float) $this->cart_or_fail()->get_total_tax();
	}

	public function empty(): self {
		$this->cart_or_fail()->empty_cart();
		return $this;
	}

	public function assertTotal( float $expected, string $message = '' ): self {
		Assert::assertEqualsWithDelta(
			$expected,
			$this->getTotal(),
			0.001,
			'' !== $message ? $message : sprintf( 'Expected cart total %.2f, but got %.2f', $expected, $this->getTotal() )
		);
		return $this;
	}

	public function assertSubtotal( float $expected, string $message = '' ): self {
		Assert::assertEqualsWithDelta(
			$expected,
			$this->getSubtotal(),
			0.001,
			'' !== $message ? $message : sprintf( 'Expected cart subtotal %.2f, but got %.2f', $expected, $this->getSubtotal() )
		);
		return $this;
	}

	public function assertItemCount( int $expected, string $message = '' ): self {
		$count = isset( WC()->cart ) && is_object( WC()->cart ) ? WC()->cart->get_cart_contents_count() : 0;
		Assert::assertSame(
			$expected,
			$count,
			'' !== $message ? $message : sprintf( 'Expected %d cart items, but found %d', $expected, $count )
		);
		return $this;
	}

	/**
	 * Return the active cart or throw a meaningful exception.
	 *
	 * @return mixed WC_Cart instance.
	 */
	protected function cart_or_fail() {
		$wc = function_exists( 'WC' ) ? WC() : null;
		if ( ! is_object( $wc ) || ! isset( $wc->cart ) || ! is_object( $wc->cart ) ) {
			throw new \RuntimeException( 'CartSimulator requires an initialized WC()->cart. Ensure WooCommerce is booted (Integration\\TestCase boots StorefrontContext).' );
		}
		return $wc->cart;
	}
}
