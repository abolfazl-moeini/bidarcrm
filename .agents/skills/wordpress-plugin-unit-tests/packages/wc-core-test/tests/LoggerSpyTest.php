<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Spy\LoggerSpy;
use WPDevTest\Woocommerce\State\HookGuard;

class LoggerSpyTest extends UnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		LoggerSpy::reset();
	}

	protected function tearDown(): void {
		LoggerSpy::reset();
		HookGuard::restore();
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldCaptureWooCommerceLogs(): void {
		LoggerSpy::start();

		do_action( 'woocommerce_log_add', 'error', 'Payment gateway connection timed out.', array( 'source' => 'custom-gw' ) );
		do_action( 'woocommerce_log_add', 'info', 'Order status updated successfully.', array( 'order_id' => 45 ) );

		LoggerSpy::assertLogCount( 2 );
		LoggerSpy::assertLogContains( 'Payment gateway' );
		LoggerSpy::assertLogContains( 'Payment gateway', 'error' );
		LoggerSpy::assertLogContains( 'Order status updated', 'info' );
		LoggerSpy::assertLogDoesNotContain( 'Fatal database error' );

		$logs = LoggerSpy::getLogs();
		$this->assertCount( 2, $logs );
		$this->assertSame( 'error', $logs[0]['level'] );
		$this->assertSame( 'custom-gw', $logs[0]['context']['source'] );
	}

	/**
	 * @test
	 */
	public function itShouldResetLogs(): void {
		LoggerSpy::start();
		do_action( 'woocommerce_log_add', 'warning', 'Low stock alert', array() );
		LoggerSpy::assertLogCount( 1 );

		LoggerSpy::reset();
		$this->assertEmpty( LoggerSpy::getLogs() );
	}

	/**
	 * @test
	 */
	public function itShouldStopListeningWhenStopCalled(): void {
		LoggerSpy::start();
		LoggerSpy::stop();

		do_action( 'woocommerce_log_add', 'error', 'Ignored log', array() );
		$this->assertEmpty( LoggerSpy::getLogs() );
	}

	/**
	 * @test
	 */
	public function itShouldReattachCleanlyAcrossConsecutiveStartCallsWithoutHookGuardInterference(): void {
		// Session 1
		LoggerSpy::start();
		do_action( 'woocommerce_log_add', 'info', 'Message 1', array() );
		LoggerSpy::assertLogCount( 1 );

		// Simulate external teardown unhooking filters via HookGuard
		HookGuard::restore();

		// Session 2
		LoggerSpy::start();
		$this->assertEmpty( LoggerSpy::getLogs() );

		do_action( 'woocommerce_log_add', 'info', 'Message 2', array() );
		LoggerSpy::assertLogCount( 1 );
		LoggerSpy::assertLogContains( 'Message 2' );
	}
}
