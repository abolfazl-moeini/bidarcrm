<?php

namespace WPDevTest\Woocommerce;

use WC_Cache_Helper;
use WC_Shipping_Zone;

/**
 * Class WC_Helper_Shipping_Zones.
 *
 * This helper class should ONLY be used for unit tests!.
 *
 * @package WPDevTest\Woocommerce
 */
class Shipping_Zones {

	/**
	 * Create some mock shipping zones to test against.
	 *
	 * Note: Avoid calling remove_mock_zones() before creation to preserve isolation.
	 *
	 * @return WC_Shipping_Zone[] Array of created zones.
	 */
	public static function create_mock_zones() {
		$created_zones = array();

		// Local zone
		$zone = new WC_Shipping_Zone();
		$zone->set_zone_name( 'Local' );
		$zone->set_zone_order( 1 );
		$zone->add_location( 'GB', 'country' );
		$zone->add_location( 'CB*', 'postcode' );
		$zone->save();
		$created_zones[] = $zone;

		// Europe zone
		$zone = new WC_Shipping_Zone();
		$zone->set_zone_name( 'Europe' );
		$zone->set_zone_order( 2 );
		$zone->add_location( 'EU', 'continent' );
		$zone->save();
		$created_zones[] = $zone;

		// US california zone
		$zone = new WC_Shipping_Zone();
		$zone->set_zone_name( 'California' );
		$zone->set_zone_order( 3 );
		$zone->add_location( 'US:CA', 'state' );
		$zone->save();
		$created_zones[] = $zone;

		// US zone
		$zone = new WC_Shipping_Zone();
		$zone->set_zone_name( 'US' );
		$zone->set_zone_order( 4 );
		$zone->add_location( 'US', 'country' );
		$zone->save();
		$created_zones[] = $zone;

		if ( class_exists( '\WPDevTest\Woocommerce\State\ResourceRegistry' ) ) {
			foreach ( $created_zones as $created_zone ) {
				\WPDevTest\Woocommerce\State\ResourceRegistry::register( 'shipping_zone', $created_zone->get_id() );
			}
		}

		return $created_zones;
	}

	/**
	 * Remove mock zones using safe DELETE FROM instead of TRUNCATE.
	 *
	 * TRUNCATE triggers an implicit MySQL commit which breaks WP_UnitTestCase
	 * transaction rollbacks. DELETE FROM preserves transaction isolation.
	 *
	 * Prefers scoped deletion of zones tracked in ResourceRegistry so zones
	 * created by other tests are preserved. Falls back to deleting all zones
	 * only when the registry holds no tracked shipping zones (legacy behavior).
	 */
	public static function remove_mock_zones() {
		global $wpdb;

		if ( class_exists( '\WPDevTest\Woocommerce\State\ResourceRegistry' ) ) {
			$tracked = \WPDevTest\Woocommerce\State\ResourceRegistry::get( 'shipping_zone' );
			if ( ! empty( $tracked ) ) {
				\WPDevTest\Woocommerce\State\ResourceRegistry::cleanup();
				if ( class_exists( 'WC_Cache_Helper' ) ) {
					WC_Cache_Helper::invalidate_cache_group( 'shipping_zones' );
				}
				return;
			}
		}

		if ( isset( $wpdb ) && is_object( $wpdb ) ) {
			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_shipping_zone_methods;" );
			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_shipping_zone_locations;" );
			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_shipping_zones;" );
		}

		if ( class_exists( 'WC_Cache_Helper' ) ) {
			WC_Cache_Helper::invalidate_cache_group( 'shipping_zones' );
		}
	}
}
