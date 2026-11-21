<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\State\HookGuard;

class HookGuardTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldTrackAndRestoreHooks(): void {
		if ( ! function_exists( 'add_filter' ) ) {
			$this->markTestSkipped( 'WordPress hooks system not booted.' );
		}

		$callback = '__return_true';
		add_filter( 'test_hook_guard_filter', $callback, 10 );
		HookGuard::track( 'test_hook_guard_filter', $callback, 10 );

		$this->assertSame( 10, has_filter( 'test_hook_guard_filter', $callback ) );

		HookGuard::restore();

		$this->assertFalse( has_filter( 'test_hook_guard_filter', $callback ) );
	}
}
