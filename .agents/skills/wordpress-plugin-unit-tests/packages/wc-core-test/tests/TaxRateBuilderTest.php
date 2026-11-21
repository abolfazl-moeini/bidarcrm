<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\TaxRateBuilder;
use WPDevTest\Woocommerce\State\ResourceRegistry;

class TaxRateBuilderTest extends UnitTestCase {

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
	public function itShouldCreateTaxRateAndRegisterIdForTeardown(): void {
		$rate_id = TaxRateBuilder::new()
			->forCountry( 'US', 'CA' )
			->withRate( 7.25, 'California State Tax' )
			->compound( false )
			->appliesToShipping( true )
			->taxClass( 'standard' )
			->create();

		$this->assertGreaterThan( 0, $rate_id );

		$registered = ResourceRegistry::get( 'tax_rate' );
		$this->assertContains( $rate_id, $registered );
	}

	/**
	 * @test
	 */
	public function itShouldSupportPostcodeAndCityLocations(): void {
		$rate_id = TaxRateBuilder::new()
			->forCountry( 'US', 'NY' )
			->forCity( 'New York' )
			->forPostcode( '10001' )
			->withRate( 8.875, 'NYC Sales Tax' )
			->create();

		$this->assertGreaterThan( 0, $rate_id );
		$registered = ResourceRegistry::get( 'tax_rate' );
		$this->assertContains( $rate_id, $registered );
	}
}

