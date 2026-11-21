<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\AbstractBuilder;

class ConcreteTestBuilder extends AbstractBuilder {
	public string $name = 'concrete';
	public int $quantity = 5;

	public function create(): string {
		return 'created_' . $this->name;
	}
}

class AbstractBuilderTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldInstantiateViaNew(): void {
		$builder = ConcreteTestBuilder::new();
		$this->assertInstanceOf( ConcreteTestBuilder::class, $builder );
	}

	/**
	 * @test
	 */
	public function itShouldDelegateSaveToCreate(): void {
		$builder = ConcreteTestBuilder::new();
		$this->assertSame( 'created_concrete', $builder->save() );
	}

	/**
	 * @test
	 */
	public function itShouldConvertBuilderStateToArray(): void {
		$builder = ConcreteTestBuilder::new();
		$array   = $builder->toArray();

		$this->assertIsArray( $array );
		$this->assertSame( 'concrete', $array['name'] );
		$this->assertSame( 5, $array['quantity'] );
	}
}
