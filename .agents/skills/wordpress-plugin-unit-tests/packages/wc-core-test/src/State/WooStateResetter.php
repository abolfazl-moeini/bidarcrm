<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\State;

use WC_Cache_Helper;

/**
 * Resets in-memory WooCommerce state, caches, notices, and sessions between tests.
 */
class WooStateResetter {

	/**
	 * Reset all volatile WooCommerce in-memory state.
	 *
	 * Safe to call even when WooCommerce is only partially initialized.
	 *
	 * @return void
	 */
	public static function reset(): void {
		self::reset_cart();
		self::reset_session();
		self::reset_notices();
		self::reset_caches();
		self::reset_spies();
		self::reset_superglobals();
	}

	/**
	 * Empty and reset the active cart.
	 *
	 * @return void
	 */
	public static function reset_cart(): void {
		if ( function_exists( 'WC' ) && isset( WC()->cart ) && is_object( WC()->cart ) ) {
			WC()->cart->empty_cart();
		}
	}

	/**
	 * Clean up and destroy the active session and reset session customer.
	 *
	 * @return void
	 */
	public static function reset_session(): void {
		if ( function_exists( 'WC' ) && isset( WC()->session ) && is_object( WC()->session ) ) {
			if ( method_exists( WC()->session, 'cleanup_session' ) ) {
				WC()->session->cleanup_session();
			}
			if ( method_exists( WC()->session, 'destroy_session' ) ) {
				WC()->session->destroy_session();
			}
		}

		if ( function_exists( 'WC' ) && isset( WC()->customer ) && is_object( WC()->customer ) ) {
			if ( class_exists( 'WC_Customer' ) ) {
				WC()->customer = new \WC_Customer( 0, true );
			}
		}
	}

	/**
	 * Clear any pending WooCommerce customer notices.
	 *
	 * @return void
	 */
	public static function reset_notices(): void {
		if ( function_exists( 'wc_clear_notices' ) ) {
			wc_clear_notices();
		}
	}

	/**
	 * Invalidate static shipping and country caches.
	 *
	 * @return void
	 */
	public static function reset_caches(): void {
		if ( class_exists( 'WC_Cache_Helper' ) ) {
			WC_Cache_Helper::get_transient_version( 'shipping', true );
			WC_Cache_Helper::invalidate_cache_group( 'shipping_zones' );
		}
	}

	/**
	 * Reset test spies (EmailSpy and LoggerSpy) to prevent cross-test leakage.
	 *
	 * @return void
	 */
	public static function reset_spies(): void {
		if ( class_exists( 'WPDevTest\Woocommerce\Spy\EmailSpy' ) ) {
			\WPDevTest\Woocommerce\Spy\EmailSpy::reset();
		}
		if ( class_exists( 'WPDevTest\Woocommerce\Spy\LoggerSpy' ) ) {
			\WPDevTest\Woocommerce\Spy\LoggerSpy::reset();
		}
	}

	/** @var string|null Initial REMOTE_ADDR snapshot */
	protected static ?string $initial_remote_addr = null;
	protected static bool $has_initial_remote_addr = false;

	/**
	 * Capture initial REMOTE_ADDR snapshot if present in the environment.
	 */
	public static function capture_initial_snapshot(): void {
		if ( ! self::$has_initial_remote_addr && isset( $_SERVER['REMOTE_ADDR'] ) ) {
			self::$initial_remote_addr     = (string) $_SERVER['REMOTE_ADDR'];
			self::$has_initial_remote_addr = true;
		}
	}

	/**
	 * Override or reset baseline REMOTE_ADDR for testing or custom runner baselines.
	 *
	 * @param string|null $ip
	 */
	public static function set_baseline_remote_addr( ?string $ip ): void {
		self::$initial_remote_addr     = $ip;
		self::$has_initial_remote_addr = ( null !== $ip );
	}

	/**
	 * Revert any superglobals modified during test arrangement.
	 *
	 * Restores REMOTE_ADDR to its initial process snapshot (or unsets if not originally present)
	 * and empties $_POST, $_GET, and $_REQUEST.
	 *
	 * @return void
	 */
	public static function reset_superglobals(): void {
		if ( self::$has_initial_remote_addr && null !== self::$initial_remote_addr ) {
			$_SERVER['REMOTE_ADDR'] = self::$initial_remote_addr;
		} elseif ( isset( $_SERVER['REMOTE_ADDR'] ) ) {
			unset( $_SERVER['REMOTE_ADDR'] );
		}

		$_POST    = array();
		$_GET     = array();
		$_REQUEST = array();
	}
}

WooStateResetter::capture_initial_snapshot();


