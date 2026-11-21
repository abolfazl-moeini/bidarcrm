<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use PHPUnit\Framework\TestCase;
use WPDevTest\Woocommerce\State\ResourceRegistry;

class ResourceRegistryTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		ResourceRegistry::reset();
	}

	protected function tearDown(): void {
		ResourceRegistry::reset();
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldTrackAndRetrieveRegisteredResourceIds(): void {
		ResourceRegistry::register( 'shipping_zone', 10 );
		ResourceRegistry::register( 'shipping_zone', 20 );
		ResourceRegistry::register( 'tax_rate', 5 );

		$this->assertSame( array( 10, 20 ), ResourceRegistry::get( 'shipping_zone' ) );
		$this->assertSame( array( 5 ), ResourceRegistry::get( 'tax_rate' ) );
	}

	/**
	 * @test
	 */
	public function itShouldIgnoreZeroAndNegativeIds(): void {
		ResourceRegistry::register( 'shipping_zone', 0 );
		ResourceRegistry::register( 'shipping_zone', -1 );

		$this->assertEmpty( ResourceRegistry::get( 'shipping_zone' ) );
	}

	/**
	 * @test
	 */
	public function itShouldReturnAllRegisteredResources(): void {
		ResourceRegistry::register( 'shipping_zone', 10 );
		ResourceRegistry::register( 'tax_rate', 5 );

		$all = ResourceRegistry::getAll();
		$this->assertArrayHasKey( 'shipping_zone', $all );
		$this->assertArrayHasKey( 'tax_rate', $all );
		$this->assertSame( array( 10 ), $all['shipping_zone'] );
		$this->assertSame( array( 5 ), $all['tax_rate'] );
	}

	/**
	 * @test
	 */
	public function itShouldExecuteSafeDeleteQueriesDuringCleanup(): void {
		global $wpdb;
		$wpdb->queries = array();

		ResourceRegistry::register( 'shipping_zone', 100 );
		ResourceRegistry::register( 'tax_rate', 200 );
		ResourceRegistry::register( 'payment_token', 300 );

		ResourceRegistry::cleanup();

		$this->assertEmpty( ResourceRegistry::getAll() );
		$this->assertNotEmpty( $wpdb->queries );

		$has_zone_delete  = false;
		$has_tax_delete   = false;
		$has_token_delete = false;

		foreach ( $wpdb->queries as $q ) {
			$this->assertStringNotContainsString( 'TRUNCATE', $q );
			if ( false !== strpos( $q, 'woocommerce_shipping_zones' ) ) {
				$has_zone_delete = true;
			}
			if ( false !== strpos( $q, 'woocommerce_tax_rates' ) ) {
				$has_tax_delete = true;
			}
			if ( false !== strpos( $q, 'woocommerce_payment_tokens' ) ) {
				$has_token_delete = true;
			}
		}

		$this->assertTrue( $has_zone_delete, 'Expected shipping zones DELETE query.' );
		$this->assertTrue( $has_tax_delete, 'Expected tax rates DELETE query.' );
		$this->assertTrue( $has_token_delete, 'Expected payment tokens DELETE query.' );
	}

	/**
	 * @test
	 */
	public function itShouldHandleCleanupGracefullyWhenWpdbIsMissing(): void {
		$orig_wpdb = $GLOBALS['wpdb'] ?? null;
		unset( $GLOBALS['wpdb'] );

		try {
			ResourceRegistry::register( 'shipping_zone', 123 );
			ResourceRegistry::cleanup();
			$this->assertEmpty( ResourceRegistry::getAll() );
		} finally {
			$GLOBALS['wpdb'] = $orig_wpdb;
		}
	}
}
