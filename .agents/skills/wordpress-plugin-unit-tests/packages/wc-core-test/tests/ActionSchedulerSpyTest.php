<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Spy\ActionSchedulerSpy;

class ActionSchedulerSpyTest extends UnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['as_scheduled_actions'] = array();
	}

	/**
	 * @test
	 */
	public function itShouldAssertActionScheduledAndNotScheduled(): void {
		ActionSchedulerSpy::assertActionNotScheduled( 'my_plugin_scheduled_sync' );

		$GLOBALS['as_scheduled_actions']['my_plugin_scheduled_sync'] = array( 'order_id' => 10 );

		ActionSchedulerSpy::assertActionScheduled( 'my_plugin_scheduled_sync' );
	}

	/**
	 * @test
	 */
	public function itShouldRunDueActionsViaQueueRunner(): void {
		$processed = ActionSchedulerSpy::runDueActions();
		$this->assertSame( 3, $processed );
	}

	/**
	 * @test
	 */
	public function itShouldCountExecutionsFromAfterExecuteHook(): void {
		$runner = new class {
			public function run(): void {
				do_action( 'action_scheduler_after_execute', 101, null );
				do_action( 'action_scheduler_after_execute', 102, null );
			}
		};
		\ActionScheduler_QueueRunner::$instance = $runner;

		$processed = ActionSchedulerSpy::runDueActions();
		$this->assertSame( 2, $processed );

		\ActionScheduler_QueueRunner::$instance = null;
	}
}

