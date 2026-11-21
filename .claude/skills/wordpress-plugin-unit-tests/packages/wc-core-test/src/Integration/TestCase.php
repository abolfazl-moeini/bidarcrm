<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Integration;

use WPDevTest\Woocommerce\State\WooStateResetter;
use WPDevTest\Woocommerce\State\ResourceRegistry;
use WPDevTest\Woocommerce\State\HookGuard;
use WPDevTest\Woocommerce\Integration\StorefrontContext;

if ( ! class_exists( __NAMESPACE__ . '\_BaseTestCase', false ) ) {
	if ( class_exists( 'WPDevTest\TestCases\TestCase' ) ) {
		abstract class _BaseTestCase extends \WPDevTest\TestCases\TestCase {}
	} elseif ( class_exists( 'WP_UnitTestCase' ) ) {
		abstract class _BaseTestCase extends \WP_UnitTestCase {}
	} else {
		abstract class _BaseTestCase extends \PHPUnit\Framework\TestCase {}
	}
}

/**
 * Base test case for WooCommerce integration tests with database isolation.
 */
abstract class TestCase extends _BaseTestCase {

	/**
	 * Set up test environment with clean WooCommerce state.
	 */
	public function setUp(): void {
		parent::setUp();
		WooStateResetter::reset();
		StorefrontContext::boot();
	}

	/**
	 * Tear down test environment.
	 *
	 * Uses try/finally to guarantee parent::tearDown() always rolls back database transactions,
	 * even if WooCommerce cleanup throws an exception.
	 */
	public function tearDown(): void {
		try {
			WooStateResetter::reset();
			ResourceRegistry::cleanup();
			HookGuard::restore();
		} finally {
			parent::tearDown();
		}
	}
}
