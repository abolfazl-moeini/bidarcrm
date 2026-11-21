<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Integration\Datastore;

/**
 * Manages WooCommerce Order Datastore state between HPOS and Legacy CPT.
 */
class DatastoreMatrix {

	public const HPOS_AUTHORITATIVE = 'hpos_authoritative';
	public const HPOS_WITH_SYNC     = 'hpos_with_sync';
	public const LEGACY_CPT         = 'legacy_cpt';

	/**
	 * Switch WooCommerce order storage mode.
	 *
	 * @param string $mode One of DatastoreMatrix constants.
	 * @return void
	 */
	public static function switch_to( string $mode ): void {
		switch ( $mode ) {
			case self::HPOS_AUTHORITATIVE:
				update_option( 'woocommerce_custom_orders_table_enabled', 'yes' );
				update_option( 'woocommerce_custom_orders_table_data_sync_enabled', 'no' );
				break;

			case self::HPOS_WITH_SYNC:
				update_option( 'woocommerce_custom_orders_table_enabled', 'yes' );
				update_option( 'woocommerce_custom_orders_table_data_sync_enabled', 'yes' );
				break;

			case self::LEGACY_CPT:
			default:
				update_option( 'woocommerce_custom_orders_table_enabled', 'no' );
				update_option( 'woocommerce_custom_orders_table_data_sync_enabled', 'no' );
				break;
		}

		// Invalidate WooCommerce data store cache if OrderUtil exists.
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			if ( method_exists( '\Automattic\WooCommerce\Utilities\OrderUtil', 'init' ) ) {
				\Automattic\WooCommerce\Utilities\OrderUtil::init();
			}
		}
	}

	/**
	 * Check if HPOS is currently authoritative.
	 *
	 * @return bool
	 */
	public static function is_hpos_authoritative(): bool {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			if ( method_exists( '\Automattic\WooCommerce\Utilities\OrderUtil', 'custom_orders_table_usage_is_enabled' ) ) {
				return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
			}
		}
		return 'yes' === get_option( 'woocommerce_custom_orders_table_enabled', 'no' );
	}

	/**
	 * Check if data synchronization between HPOS and posts table is enabled.
	 *
	 * @return bool
	 */
	public static function is_sync_enabled(): bool {
		return 'yes' === get_option( 'woocommerce_custom_orders_table_data_sync_enabled', 'no' );
	}

	/**
	 * Check if storage mode is Legacy CPT.
	 *
	 * @return bool
	 */
	public static function is_legacy_cpt(): bool {
		return ! self::is_hpos_authoritative();
	}

	/**
	 * Get the current datastore mode.
	 *
	 * @return string One of DatastoreMatrix constants.
	 */
	public static function get_current_mode(): string {
		if ( ! self::is_hpos_authoritative() ) {
			return self::LEGACY_CPT;
		}
		return self::is_sync_enabled() ? self::HPOS_WITH_SYNC : self::HPOS_AUTHORITATIVE;
	}
}
