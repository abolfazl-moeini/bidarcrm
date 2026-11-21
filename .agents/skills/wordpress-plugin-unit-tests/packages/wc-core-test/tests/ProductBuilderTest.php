<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\ProductBuilder;
use WC_Product_Simple;
use WC_Product_External;
use WC_Product_Grouped;
use WC_Product_Variable;

class ProductBuilderTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldBuildSimpleProductWithDefaults(): void {
		$product = ProductBuilder::new()
			->named( 'Standard Widget' )
			->priced( 29.99 )
			->sku( 'WIDGET-01' )
			->inStock( 15, true )
			->create();

		$this->assertInstanceOf( WC_Product_Simple::class, $product );
		$this->assertSame( 'Standard Widget', $product->get_name() );
		$this->assertSame( 29.99, $product->get_price() );
	}

	/**
	 * @test
	 */
	public function itShouldBuildSalePricedProduct(): void {
		$product = ProductBuilder::new()
			->named( 'Discounted Item' )
			->priced( 50.0, 39.99 )
			->create();

		$this->assertSame( 39.99, $product->get_price() );
	}

	/**
	 * @test
	 */
	public function itShouldBuildExternalProduct(): void {
		$product = ProductBuilder::new()
			->external()
			->named( 'External Affiliate' )
			->priced( 99.0 )
			->create();

		$this->assertInstanceOf( WC_Product_External::class, $product );
	}

	/**
	 * @test
	 */
	public function itShouldBuildGroupedProduct(): void {
		$product = ProductBuilder::new()
			->grouped()
			->named( 'Grouped Collection' )
			->create();

		$this->assertInstanceOf( WC_Product_Grouped::class, $product );
	}

	/**
	 * @test
	 */
	public function itShouldBuildVariableProductWithAttributesAndVariations(): void {
		$product = ProductBuilder::new()
			->variable()
			->named( 'T-Shirt' )
			->withAttribute( 'Size', array( 'S', 'M', 'L' ), true )
			->withVariation( 'TSHIRT-S', 19.99, array( 'size' => 'S' ) )
			->withVariation( 'TSHIRT-M', 21.99, array( 'size' => 'M' ) )
			->create();

		$this->assertInstanceOf( WC_Product_Variable::class, $product );
		$this->assertCount( 2, $product->children );
	}

	/**
	 * @test
	 */
	public function itShouldSupportUnsavedBuild(): void {
		$product = ProductBuilder::new()
			->named( 'Unsaved Item' )
			->priced( 15.0 )
			->build();

		$this->assertInstanceOf( WC_Product_Simple::class, $product );
		$this->assertSame( 'Unsaved Item', $product->get_name() );
	}
}
