<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

/**
 * Base abstract class for fluent entity builders.
 */
abstract class AbstractBuilder {

	/**
	 * Instantiate a new builder.
	 *
	 * @return static
	 */
	public static function new() {
		return new static();
	}

	/**
	 * Build and persist the entity.
	 *
	 * @return mixed
	 */
	abstract public function create();

	/**
	 * Alias for create() to persist the entity.
	 *
	 * @return mixed
	 */
	public function save() {
		return $this->create();
	}

	/**
	 * Convert the builder state to an associative array of properties.
	 *
	 * @return array
	 */
	public function toArray(): array {
		return get_object_vars( $this );
	}
}
