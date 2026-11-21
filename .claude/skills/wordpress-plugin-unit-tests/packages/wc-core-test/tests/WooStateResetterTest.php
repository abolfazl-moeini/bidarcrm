<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use PHPUnit\Framework\TestCase;
use WPDevTest\Woocommerce\State\WooStateResetter;

class WooStateResetterTest extends TestCase {

	/**
	 * @test
	 */
	public function itShouldSafelyExecuteResetWithoutErrorsWhenWooCommerceNotBooted(): void {
		$_SERVER['REMOTE_ADDR'] = '192.168.1.100';
		$_POST['test_key']      = 'post_val';
		$_GET['filter']         = 'active';
		$_REQUEST['action']     = 'update';

		WooStateResetter::reset();

		$this->assertArrayNotHasKey( 'REMOTE_ADDR', $_SERVER, 'Expected REMOTE_ADDR to be unset by reset_superglobals' );
		$this->assertEmpty( $_POST );
		$this->assertEmpty( $_GET );
		$this->assertEmpty( $_REQUEST );
	}

	/**
	 * @test
	 */
	public function itShouldRestoreBaselineRemoteAddrWhenConfigured(): void {
		WooStateResetter::set_baseline_remote_addr( '127.0.0.1' );
		$_SERVER['REMOTE_ADDR'] = '10.0.0.99';

		WooStateResetter::reset();

		$this->assertSame( '127.0.0.1', $_SERVER['REMOTE_ADDR'] );

		// Clean up baseline
		WooStateResetter::set_baseline_remote_addr( null );
		unset( $_SERVER['REMOTE_ADDR'] );
	}


	/**
	 * @test
	 */
	public function itShouldResetCartAndNotices(): void {
		if ( function_exists( 'WC' ) && isset( WC()->cart ) ) {
			WC()->cart->add_to_cart( 101, 3 );
			$this->assertGreaterThan( 0, WC()->cart->get_cart_contents_count() );
		}

		if ( function_exists( 'wc_add_notice' ) ) {
			wc_add_notice( 'Notice to clear', 'notice' );
			$this->assertNotEmpty( wc_get_notices() );
		}

		WooStateResetter::reset();

		if ( function_exists( 'WC' ) && isset( WC()->cart ) ) {
			$this->assertSame( 0, WC()->cart->get_cart_contents_count() );
		}

		if ( function_exists( 'wc_get_notices' ) ) {
			$this->assertEmpty( wc_get_notices() );
		}
	}

	/**
	 * @test
	 */
	public function itShouldResetSessionAndCustomer(): void {
		if ( function_exists( 'WC' ) && isset( WC()->session ) ) {
			WC()->session->set( 'some_test_session_key', 'value123' );
			$this->assertSame( 'value123', WC()->session->get( 'some_test_session_key' ) );
		}

		WooStateResetter::reset_session();

		if ( function_exists( 'WC' ) && isset( WC()->session ) ) {
			$this->assertNull( WC()->session->get( 'some_test_session_key' ) );
		}
	}
}
