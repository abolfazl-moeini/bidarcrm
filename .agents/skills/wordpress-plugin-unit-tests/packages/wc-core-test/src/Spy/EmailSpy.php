<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Spy;

use PHPUnit\Framework\Assert;
use WPDevTest\Woocommerce\State\HookGuard;

/**
 * In-memory spy for capturing and asserting emails sent via wp_mail during WooCommerce tests.
 */
class EmailSpy {

	/** @var array<array{to: string|array, subject: string, message: string, headers: array}> */
	protected static array $captured_emails = array();

	/** @var string[] */
	protected static array $captured_actions = array();

	protected static bool $is_listening = false;

	/**
	 * Standard WooCommerce email action hooks.
	 *
	 * @var string[]
	 */
	protected static array $standard_email_actions = array(
		'woocommerce_order_status_pending_to_processing_notification',
		'woocommerce_order_status_pending_to_completed_notification',
		'woocommerce_order_status_pending_to_on-hold_notification',
		'woocommerce_order_status_failed_to_processing_notification',
		'woocommerce_order_status_failed_to_completed_notification',
		'woocommerce_order_status_failed_to_on-hold_notification',
		'woocommerce_order_status_cancelled_to_processing_notification',
		'woocommerce_order_status_cancelled_to_completed_notification',
		'woocommerce_order_status_cancelled_to_on-hold_notification',
		'woocommerce_new_customer_note_notification',
		'woocommerce_created_customer_notification',
	);

	/** @var array<array{tag: string, callback: callable, priority: int}> */
	protected static array $registered_callbacks = array();

	/**
	 * Begin listening to wp_mail calls and WooCommerce email actions.
	 *
	 * Cleans any prior sessions and safely re-attaches listeners.
	 *
	 * @return void
	 */
	public static function start(): void {
		self::stop();
		self::$captured_emails  = array();
		self::$captured_actions = array();

		if ( function_exists( 'add_filter' ) ) {
			// Short-circuit mail delivery while capturing arguments
			$pre_callback = function ( $return, $args ) {
				self::$captured_emails[] = is_array( $args ) ? $args : array();
				return true;
			};
			add_filter( 'pre_wp_mail', $pre_callback, 999, 2 );
			HookGuard::track( 'pre_wp_mail', $pre_callback, 999 );
			self::$registered_callbacks[] = array(
				'tag'      => 'pre_wp_mail',
				'callback' => $pre_callback,
				'priority' => 999,
			);

			// Fallback capture on wp_mail filter
			$mail_callback = function ( $args ) {
				if ( empty( self::$captured_emails ) ) {
					self::$captured_emails[] = is_array( $args ) ? $args : array();
				}
				return $args;
			};
			add_filter( 'wp_mail', $mail_callback, 999 );
			HookGuard::track( 'wp_mail', $mail_callback, 999 );
			self::$registered_callbacks[] = array(
				'tag'      => 'wp_mail',
				'callback' => $mail_callback,
				'priority' => 999,
			);
		}

		if ( function_exists( 'add_action' ) ) {
			foreach ( self::$standard_email_actions as $action_hook ) {
				$action_cb = function () use ( $action_hook ) {
					self::$captured_actions[] = $action_hook;
				};
				add_action( $action_hook, $action_cb, 10, 0 );
				HookGuard::track( $action_hook, $action_cb, 10 );
				self::$registered_callbacks[] = array(
					'tag'      => $action_hook,
					'callback' => $action_cb,
					'priority' => 10,
				);
			}
		}

		self::$is_listening = true;
	}

	/**
	 * Assert an email was dispatched to the specified recipient.
	 *
	 * @param string      $recipient
	 * @param string|null $subject_contains
	 * @return void
	 */
	public static function assertEmailSent( string $recipient, ?string $subject_contains = null ): void {
		$found = false;

		foreach ( self::$captured_emails as $email ) {
			$to = isset( $email['to'] ) && is_array( $email['to'] ) ? implode( ',', $email['to'] ) : (string) ( $email['to'] ?? '' );
			if ( false !== strpos( $to, $recipient ) ) {
				if ( null === $subject_contains || false !== strpos( (string) ( $email['subject'] ?? '' ), $subject_contains ) ) {
					$found = true;
					break;
				}
			}
		}

		Assert::assertTrue( $found, sprintf( 'Expected email sent to "%s" was not captured.', $recipient ) );
	}

	/**
	 * Assert that a WooCommerce email notification action was triggered.
	 *
	 * @param string $action_hook
	 * @param string $message
	 * @return void
	 */
	public static function assertEmailActionTriggered( string $action_hook, string $message = '' ): void {
		$found = in_array( $action_hook, self::$captured_actions, true );
		Assert::assertTrue(
			$found,
			'' !== $message ? $message : sprintf( 'Expected WooCommerce email action "%s" was not triggered.', $action_hook )
		);
	}

	/**
	 * Assert that a WooCommerce email notification action was NOT triggered.
	 *
	 * @param string $action_hook
	 * @param string $message
	 * @return void
	 */
	public static function assertEmailActionNotTriggered( string $action_hook, string $message = '' ): void {
		$found = in_array( $action_hook, self::$captured_actions, true );
		Assert::assertFalse(
			$found,
			'' !== $message ? $message : sprintf( 'Expected WooCommerce email action "%s" not to be triggered, but it was.', $action_hook )
		);
	}

	/**
	 * Assert that no emails were dispatched.
	 *
	 * @return void
	 */
	public static function assertNoEmailsSent(): void {
		Assert::assertEmpty( self::$captured_emails, 'Expected zero emails to be sent, but some were captured.' );
	}

	/**
	 * Get all captured emails.
	 *
	 * @return array<array{to: string|array, subject: string, message: string, headers: array}>
	 */
	public static function getEmails(): array {
		return self::$captured_emails;
	}

	/**
	 * Get all captured email actions.
	 *
	 * @return string[]
	 */
	public static function getEmailActions(): array {
		return self::$captured_actions;
	}

	/**
	 * Stop listening and detach all registered hooks.
	 *
	 * @return void
	 */
	public static function stop(): void {
		if ( function_exists( 'remove_filter' ) ) {
			foreach ( self::$registered_callbacks as $entry ) {
				remove_filter( $entry['tag'], $entry['callback'], $entry['priority'] );
			}
		}
		self::$registered_callbacks = array();
		self::$is_listening         = false;
	}

	/**
	 * Reset captured emails and listening state.
	 *
	 * @return void
	 */
	public static function reset(): void {
		self::stop();
		self::$captured_emails  = array();
		self::$captured_actions = array();
	}
}
