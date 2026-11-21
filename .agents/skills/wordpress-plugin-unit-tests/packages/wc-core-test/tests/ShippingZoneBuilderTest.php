<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\ShippingZoneBuilder;
use WPDevTest\Woocommerce\State\ResourceRegistry;
use WC_Shipping_Zone;

class ShippingZoneBuilderTest extends UnitTestCase {

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
	public function itShouldCreateShippingZoneAndRegisterIdForTeardown(): void {
		$zone = ShippingZoneBuilder::new()
			->named( 'North America Zone' )
			->order( 2 )
			->withLocation( 'US', 'country' )
			->withLocation( 'CA', 'country' )
			->withMethod( 'flat_rate' )
			->create();

		$this->assertInstanceOf( WC_Shipping_Zone::class, $zone );
		$this->assertSame( 'North America Zone', $zone->name );
		$this->assertSame( 2, $zone->order );
		$this->assertCount( 2, $zone->locations );
		$this->assertContains( 'flat_rate', $zone->methods );

		// Check ResourceRegistry registration
		$registered = ResourceRegistry::get( 'shipping_zone' );
		$this->assertContains( $zone->get_id(), $registered );
	}
}
