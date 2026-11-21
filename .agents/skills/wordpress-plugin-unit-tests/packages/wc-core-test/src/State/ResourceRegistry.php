<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\State;

use WC_Cache_Helper;

/**
 * Tracks database records that bypass standard transactional rollback (e.g. shipping zones, tax rates).
 *
 * Deletes tracked records using safe DELETE FROM statements rather than TRUNCATE.
 */
class ResourceRegistry {

	/**
	 * Map of resource types to array of IDs.
	 *
	 * @var array<string, int[]>
	 */
	protected static $registry = array();

	/**
	 * Register a created resource ID.
	 *
	 * @param string $type Resource type ('shipping_zone', 'tax_rate', 'payment_token').
	 * @param int    $id   Record primary key ID.
	 * @return void
	 */
	public static function register( string $type, int $id ): void {
		if ( $id <= 0 ) {
			return;
		}
		if ( ! isset( self::$registry[ $type ] ) ) {
			self::$registry[ $type ] = array();
		}
		self::$registry[ $type ][] = $id;
	}

	/**
	 * Retrieve registered IDs for a type.
	 *
	 * @param string $type
	 * @return int[]
	 */
	public static function get( string $type ): array {
		return isset( self::$registry[ $type ] ) ? self::$registry[ $type ] : array();
	}

	/**
	 * Retrieve all registered resources grouped by type.
	 *
	 * @return array<string, int[]>
	 */
	public static function getAll(): array {
		return self::$registry;
	}

	/**
	 * Delete all registered resources from database tables and reset registry.
	 *
	 * @return void
	 */
	public static function cleanup(): void {
		global $wpdb;

		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) ) {
			self::$registry = array();
			return;
		}

		if ( ! empty( self::$registry['shipping_zone'] ) ) {
			$ids = array_map( 'intval', array_unique( self::$registry['shipping_zone'] ) );
			$in  = implode( ',', $ids );

			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_shipping_zone_methods WHERE zone_id IN ({$in});" );
			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_shipping_zone_locations WHERE zone_id IN ({$in});" );
			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_shipping_zones WHERE zone_id IN ({$in});" );

			if ( class_exists( 'WC_Cache_Helper' ) ) {
				WC_Cache_Helper::invalidate_cache_group( 'shipping_zones' );
			}
		}

		if ( ! empty( self::$registry['tax_rate'] ) ) {
			$ids = array_map( 'intval', array_unique( self::$registry['tax_rate'] ) );
			$in  = implode( ',', $ids );

			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_tax_rate_locations WHERE tax_rate_id IN ({$in});" );
			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_tax_rates WHERE tax_rate_id IN ({$in});" );

			if ( class_exists( 'WC_Cache_Helper' ) ) {
				WC_Cache_Helper::invalidate_cache_group( 'taxes' );
			}
		}

		if ( ! empty( self::$registry['payment_token'] ) ) {
			$ids = array_map( 'intval', array_unique( self::$registry['payment_token'] ) );
			$in  = implode( ',', $ids );

			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_payment_tokens WHERE token_id IN ({$in});" );
			$wpdb->query( "DELETE FROM {$wpdb->prefix}woocommerce_payment_tokenmeta WHERE payment_token_id IN ({$in});" );
		}

		self::$registry = array();
	}

	/**
	 * Reset the in-memory registry without deleting rows (useful in pure unit tests).
	 *
	 * @return void
	 */
	public static function reset(): void {
		self::$registry = array();
	}
}
