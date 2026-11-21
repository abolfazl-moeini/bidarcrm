<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Spy;

use PHPUnit\Framework\Assert;
use WPDevTest\Woocommerce\State\HookGuard;

/**
 * Spies on WooCommerce logger writes without touching the disk filesystem.
 */
class LoggerSpy {

	/** @var array<array{level: string, message: string, context: array}> */
	protected static array $logs = array();
	/** @var array<array{tag: string, callback: callable, priority: int}> */
	protected static array $registered_callbacks = array();
	protected static bool $is_listening = false;

	public static function start(): void {
		self::stop();
		self::$logs = array();

		if ( function_exists( 'add_action' ) ) {
			$callback = function ( $level, $message, $context ) {
				self::$logs[] = array(
					'level'   => (string) $level,
					'message' => (string) $message,
					'context' => is_array( $context ) ? $context : array(),
				);
			};

			add_action( 'woocommerce_log_add', $callback, 10, 3 );
			HookGuard::track( 'woocommerce_log_add', $callback, 10 );
			self::$registered_callbacks[] = array(
				'tag'      => 'woocommerce_log_add',
				'callback' => $callback,
				'priority' => 10,
			);
		}

		self::$is_listening = true;
	}

	public static function assertLogContains( string $needle, ?string $level = null, string $message = '' ): void {
		$found = false;

		foreach ( self::$logs as $log ) {
			if ( false !== strpos( $log['message'], $needle ) ) {
				if ( null === $level || $log['level'] === $level ) {
					$found = true;
					break;
				}
			}
		}

		Assert::assertTrue(
			$found,
			'' !== $message ? $message : sprintf( 'Expected log entry containing "%s" was not found.', $needle )
		);
	}

	public static function assertLogDoesNotContain( string $needle, ?string $level = null, string $message = '' ): void {
		$found = false;

		foreach ( self::$logs as $log ) {
			if ( false !== strpos( $log['message'], $needle ) ) {
				if ( null === $level || $log['level'] === $level ) {
					$found = true;
					break;
				}
			}
		}

		Assert::assertFalse(
			$found,
			'' !== $message ? $message : sprintf( 'Expected no log entry containing "%s", but found one.', $needle )
		);
	}

	public static function assertLogCount( int $expected, string $message = '' ): void {
		Assert::assertCount(
			$expected,
			self::$logs,
			'' !== $message ? $message : sprintf( 'Expected %d log entries, but found %d.', $expected, count( self::$logs ) )
		);
	}

	/**
	 * Get all captured logs.
	 *
	 * @return array<array{level: string, message: string, context: array}>
	 */
	public static function getLogs(): array {
		return self::$logs;
	}

	/**
	 * Stop listening and detach all registered hooks.
	 *
	 * @return void
	 */
	public static function stop(): void {
		if ( function_exists( 'remove_action' ) ) {
			foreach ( self::$registered_callbacks as $entry ) {
				remove_action( $entry['tag'], $entry['callback'], $entry['priority'] );
			}
		}
		self::$registered_callbacks = array();
		self::$is_listening         = false;
	}

	public static function reset(): void {
		self::stop();
		self::$logs = array();
	}
}
