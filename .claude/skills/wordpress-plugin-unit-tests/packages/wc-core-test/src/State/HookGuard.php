<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\State;

/**
 * Snapshots and restores WordPress filters and actions added during WooCommerce test runs.
 */
class HookGuard {

	/**
	 * Captured hooks that should be removed during teardown.
	 *
	 * @var array<array{tag: string, callback: callable|array|string, priority: int}>
	 */
	protected static $tracked_hooks = array();

	/**
	 * Track a hook callback for automated removal in teardown.
	 *
	 * @param string          $tag      Hook name.
	 * @param callable|array|string $callback Callback function or method.
	 * @param int             $priority Priority.
	 * @return void
	 */
	public static function track( string $tag, $callback, int $priority = 10 ): void {
		self::$tracked_hooks[] = array(
			'tag'      => $tag,
			'callback' => $callback,
			'priority' => $priority,
		);
	}

	/**
	 * Remove all tracked hooks from $wp_filter.
	 *
	 * @return void
	 */
	public static function restore(): void {
		foreach ( self::$tracked_hooks as $hook ) {
			remove_filter( $hook['tag'], $hook['callback'], $hook['priority'] );
		}
		self::$tracked_hooks = array();
	}
}
