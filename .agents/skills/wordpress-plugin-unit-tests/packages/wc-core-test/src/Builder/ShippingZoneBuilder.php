<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

use WC_Shipping_Zone;
use WPDevTest\Woocommerce\State\ResourceRegistry;

/**
 * Fluent builder for creating WooCommerce shipping zones with automatic ResourceRegistry tracking.
 */
class ShippingZoneBuilder extends AbstractBuilder {

	protected string $name = 'Test Zone';
	protected int $order = 0;
	protected array $locations = array();
	protected array $methods = array();

	public function named( string $name ): self {
		$this->name = $name;
		return $this;
	}

	public function order( int $order ): self {
		$this->order = $order;
		return $this;
	}

	public function withLocation( string $code, string $type = 'country' ): self {
		$this->locations[] = array(
			'code' => $code,
			'type' => $type,
		);
		return $this;
	}

	public function withMethod( string $method_id ): self {
		$this->methods[] = $method_id;
		return $this;
	}

	/**
	 * Build and save the zone, registering its ID for safe teardown.
	 *
	 * @return WC_Shipping_Zone
	 */
	public function create(): WC_Shipping_Zone {
		$zone = new WC_Shipping_Zone();
		$zone->set_zone_name( $this->name );
		$zone->set_zone_order( $this->order );

		foreach ( $this->locations as $loc ) {
			$zone->add_location( $loc['code'], $loc['type'] );
		}

		$zone->save();

		foreach ( $this->methods as $method_id ) {
			$zone->add_shipping_method( $method_id );
		}

		$zone_id = $zone->get_id();
		if ( $zone_id > 0 ) {
			ResourceRegistry::register( 'shipping_zone', $zone_id );
		}

		return $zone;
	}
}
