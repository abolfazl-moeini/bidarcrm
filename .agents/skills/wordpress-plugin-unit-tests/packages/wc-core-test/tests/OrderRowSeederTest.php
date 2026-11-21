<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Seed\OrderRowSeeder;
use WPDevTest\Woocommerce\Integration\Datastore\DatastoreMatrix;

class OrderRowSeederTest extends UnitTestCase {

	protected function tearDown(): void {
		DatastoreMatrix::switch_to( DatastoreMatrix::LEGACY_CPT );
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldDirectInsertOrderRowsInHposMode(): void {
		DatastoreMatrix::switch_to( DatastoreMatrix::HPOS_AUTHORITATIVE );

		$order_id = OrderRowSeeder::new()
			->withCustomer( 42 )
			->withStatus( 'completed' )
			->withTotal( 250.0 )
			->insert();

		$this->assertGreaterThan( 0, $order_id );

		global $wpdb;
		$this->assertNotEmpty( $wpdb->tables['wp_wc_orders'] ?? array() );
		$this->assertNotEmpty( $wpdb->tables['wp_wc_order_addresses'] ?? array() );
	}

	/**
	 * @test
	 */
	public function itShouldDirectInsertOrderRowsInCptMode(): void {
		DatastoreMatrix::switch_to( DatastoreMatrix::LEGACY_CPT );

		$order_id = OrderRowSeeder::new()
			->withCustomer( 88 )
			->withStatus( 'processing' )
			->withTotal( 175.50 )
			->insert();

		$this->assertGreaterThan( 0, $order_id );
		$this->assertSame( 88, get_post_meta( $order_id, '_customer_user', true ) );
		$this->assertSame( 175.50, get_post_meta( $order_id, '_order_total', true ) );
	}
}
