<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Mock;

use WC_Shipping_Method;
use WPDevTest\Woocommerce\State\HookGuard;

if ( ! class_exists( __NAMESPACE__ . '\_BaseShippingMethod', false ) ) {
	if ( ! class_exists( 'WC_Shipping_Method' ) ) {
		class _BaseShippingMethod {
			public $id;
			public $instance_id;
			public $method_title;
			public $method_description;
			public $supports = array();
			public $enabled;
			public $title;
			public function get_rate_id() {
				return $this->id;
			}
			public function add_rate( $rate = array() ) {}
		}
	} else {
		class_alias( 'WC_Shipping_Method', __NAMESPACE__ . '\_BaseShippingMethod' );
	}
}

/**
 * Configurable mock shipping method for unit and integration testing.
 */
class MockShippingMethod extends _BaseShippingMethod {

	protected float $cost = 15.0;

	public function __construct( int $instance_id = 0 ) {
		$this->id                 = 'mock_shipping';
		$this->instance_id        = $instance_id;
		$this->method_title       = 'Mock Shipping Method';
		$this->method_description = 'Simulated shipping method for testing.';
		$this->supports           = array( 'shipping-zones', 'instance-settings' );
		$this->enabled            = 'yes';
		$this->title              = 'Mock Shipping';
	}

	public function setCost( float $cost ): self {
		$this->cost = $cost;
		return $this;
	}

	public function getCost(): float {
		return $this->cost;
	}

	public function calculate_shipping( $package = array() ) {
		$rate = array(
			'id'      => $this->get_rate_id(),
			'label'   => $this->title,
			'cost'    => $this->cost,
			'package' => $package,
		);
		$this->add_rate( $rate );
	}

	/**
	 * Register this mock shipping method with WooCommerce.
	 *
	 * @return void
	 */
	public static function register(): void {
		$callback = function ( $methods ) {
			$methods['mock_shipping'] = self::class;
			return $methods;
		};

		add_filter( 'woocommerce_shipping_methods', $callback );
		HookGuard::track( 'woocommerce_shipping_methods', $callback );
	}
}
