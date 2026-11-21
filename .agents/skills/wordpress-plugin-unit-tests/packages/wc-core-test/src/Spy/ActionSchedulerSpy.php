<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Spy;

use ActionScheduler;
use ActionScheduler_QueueRunner;
use ActionScheduler_Store;
use PHPUnit\Framework\Assert;

/**
 * Spies on and executes Action Scheduler tasks synchronously during test execution.
 */
class ActionSchedulerSpy {

	/**
	 * Assert that an action is scheduled for a given hook and optional arguments.
	 *
	 * @param string $hook
	 * @param array  $args
	 * @param string $message
	 * @return void
	 */
	public static function assertActionScheduled( string $hook, array $args = array(), string $message = '' ): void {
		$is_scheduled = false;

		if ( function_exists( 'as_has_scheduled_action' ) ) {
			$is_scheduled = as_has_scheduled_action( $hook, ! empty( $args ) ? $args : null );
		} elseif ( class_exists( 'ActionScheduler_Store' ) ) {
			$actions      = ActionScheduler_Store::instance()->query_actions(
				array(
					'hook'   => $hook,
					'args'   => ! empty( $args ) ? $args : null,
					'status' => ActionScheduler_Store::STATUS_PENDING,
				)
			);
			$is_scheduled = ! empty( $actions );
		}

		$fail_message = '' !== $message
			? $message
			: sprintf( 'Expected Action Scheduler task "%s" to be scheduled, but none found.', $hook );

		Assert::assertTrue( $is_scheduled, $fail_message );
	}

	/**
	 * Assert that no action is scheduled for a given hook.
	 *
	 * @param string $hook
	 * @param string $message
	 * @return void
	 */
	public static function assertActionNotScheduled( string $hook, string $message = '' ): void {
		$is_scheduled = false;

		if ( function_exists( 'as_has_scheduled_action' ) ) {
			$is_scheduled = as_has_scheduled_action( $hook );
		} elseif ( class_exists( 'ActionScheduler_Store' ) ) {
			$actions      = ActionScheduler_Store::instance()->query_actions(
				array(
					'hook'   => $hook,
					'status' => ActionScheduler_Store::STATUS_PENDING,
				)
			);
			$is_scheduled = ! empty( $actions );
		}

		$fail_message = '' !== $message
			? $message
			: sprintf( 'Expected no Action Scheduler task "%s" to be scheduled, but found active task.', $hook );

		Assert::assertFalse( $is_scheduled, $fail_message );
	}

	/**
	 * Synchronously process all pending Action Scheduler tasks.
	 *
	 * Uses action_scheduler_after_execute hook tracking to accurately count
	 * executions (even for recurring actions), with fallback to runner return
	 * values or queue size differentials.
	 *
	 * @return int Number of actions processed (0 when the runner is unavailable).
	 */
	public static function runDueActions(): int {
		$before = self::count_pending_actions();
		$runner_result = null;

		$executed_count = 0;
		$after_execute_callback = function () use ( &$executed_count ) {
			$executed_count++;
		};

		if ( function_exists( 'add_action' ) ) {
			add_action( 'action_scheduler_after_execute', $after_execute_callback, 999 );
		}

		try {
			if ( class_exists( 'ActionScheduler_QueueRunner' ) ) {
				$runner = ActionScheduler_QueueRunner::instance();
				if ( method_exists( $runner, 'run' ) ) {
					$runner_result = $runner->run();
				}
			}
		} finally {
			if ( function_exists( 'remove_action' ) ) {
				remove_action( 'action_scheduler_after_execute', $after_execute_callback, 999 );
			}
		}

		// If actions fired action_scheduler_after_execute, use exact execution count.
		if ( $executed_count > 0 ) {
			return $executed_count;
		}

		// Legacy runners (and test doubles) return an int count; modern
		// Action Scheduler returns void, so fall back to runner return or queue-size diff.
		if ( is_int( $runner_result ) || ( is_numeric( $runner_result ) && null !== $runner_result ) ) {
			return (int) $runner_result;
		}

		$after = self::count_pending_actions();

		if ( $before > 0 && $after >= 0 && $after <= $before ) {
			return $before - $after;
		}

		return 0;
	}


	/**
	 * Count pending actions in the store.
	 *
	 * @return int -1 when the store is unavailable.
	 */
	protected static function count_pending_actions(): int {
		if ( class_exists( 'ActionScheduler_Store' ) && method_exists( 'ActionScheduler_Store', 'instance' ) ) {
			try {
				$actions = \ActionScheduler_Store::instance()->query_actions(
					array(
						'status'   => \ActionScheduler_Store::STATUS_PENDING,
						'per_page' => -1,
					)
				);
				return is_array( $actions ) ? count( $actions ) : -1;
			} catch ( \Exception $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
				return -1;
			}
		}
		return -1;
	}
}
