<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Unit;

use PHPUnit\Framework\TestCase;
use Brain\Monkey;
use Mockery;

/**
 * Base test case for fast, isolated in-memory unit testing without WordPress or MySQL.
 */
abstract class UnitTestCase extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		if ( function_exists( 'Brain\Monkey\setUp' ) ) {
			Monkey\setUp();
		}
	}

	protected function tearDown(): void {
		try {
			if ( class_exists( 'Mockery' ) ) {
				Mockery::close();
			}
			if ( function_exists( 'Brain\Monkey\tearDown' ) ) {
				Monkey\tearDown();
			}
		} finally {
			parent::tearDown();
		}
	}
}
