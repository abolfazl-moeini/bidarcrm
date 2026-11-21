<?php

namespace WPDevTest\TestCases;

use Exception;
use PHPUnit\Framework\MockObject;

abstract class BaseTestCase extends \WP_UnitTestCase {

	public function setUp(): void {

		parent::setUp();
	}

	protected static function factory() {

		static $factory = null;

		if ( ! $factory ) {
			$factory = new \WPDevTest\Factory();
		}

		return $factory;
	}


	/**
	 * Set up the expectation that a filter will be applied during the test.
	 *
	 * todo: add custom error message support
	 *
	 * @param $filter
	 *
	 * @return MockObject\Builder\InvocationMocker
	 */
	public function expectFilter( $filter, ...$arguments ): MockObject\Builder\InvocationMocker {

		$mock_builder = $this->getMockBuilder( \stdClass::class );
		if ( method_exists( $mock_builder, 'addMethods' ) ) {
			$mock_builder->addMethods( [ 'callback' ] );
		} else {
			$mock_builder->setMethods( [ 'callback' ] );
		}
		$mock = $mock_builder->getMock();


		add_filter( $filter, [ $mock, 'callback' ], PHP_INT_MAX, count( $arguments ) );

		return $mock->expects( $this->once() )
		            ->method( 'callback' )
		            ->with( ...$arguments )
		            ->willReturn( $arguments[0] ?? null );
	}

	/**
	 * @param string   $action
	 * @param callable $callback
	 * @param int      $priority
	 */
	public function expectAddAction( string $action, callable $callback, int $priority = 10, ?string $message = null ) {

		global $wp_filter;

		$idx = _wp_filter_build_unique_id( $action, $callback, $priority );

		if ( ! isset( $wp_filter[ $action ]->callbacks[ $priority ][$idx] ) ) {

			throw new Exception( $message ?? sprintf( 'the action "%s" was not found', $action ) );
		}

		$this->expectNotToPerformAssertions();
	}
}
