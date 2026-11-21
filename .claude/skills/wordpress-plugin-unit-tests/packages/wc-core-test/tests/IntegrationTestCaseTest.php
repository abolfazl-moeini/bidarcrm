<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Integration\TestCase;
use WPDevTest\Woocommerce\State\ResourceRegistry;
use WPDevTest\Woocommerce\State\HookGuard;

class ConcreteIntegrationTestCase extends TestCase {
	public bool $parent_teardown_called = false;

	public function runTestExecution(): void {
		$this->setUp();
	}

	public function runTearDownExecution(): void {
		$this->tearDown();
	}
}

class IntegrationTestCaseTest extends \PHPUnit\Framework\TestCase {

	/**
	 * @test
	 */
	public function itShouldBootStorefrontContextAndResetStateInSetUp(): void {
		$testCase = new class( 'testStub' ) extends TestCase {
			public function execute(): void {
				$this->setUp();
				$this->assertNotNull( WC()->cart );
				$this->assertNotNull( WC()->session );
			}
		};

		$testCase->execute();
	}

	/**
	 * @test
	 */
	public function itShouldExecuteCleanupAndRestoreInTearDown(): void {
		ResourceRegistry::register( 'shipping_zone', 999 );
		$callback = '__return_true';
		add_filter( 'test_integration_hook', $callback );
		HookGuard::track( 'test_integration_hook', $callback );

		$testCase = new class( 'testStub' ) extends TestCase {
			public function execute(): void {
				$this->tearDown();
			}
		};

		$testCase->execute();

		$this->assertEmpty( ResourceRegistry::getAll() );
		$this->assertFalse( has_filter( 'test_integration_hook', $callback ) );
	}
}
