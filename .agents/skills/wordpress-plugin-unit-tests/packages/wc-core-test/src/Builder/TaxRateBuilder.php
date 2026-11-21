<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

use WPDevTest\Woocommerce\State\ResourceRegistry;

/**
 * Fluent builder for creating WooCommerce tax rates with automatic ResourceRegistry tracking.
 */
class TaxRateBuilder extends AbstractBuilder {

	protected string $country = 'US';
	protected string $state = 'CA';
	protected string $postcode = '';
	protected string $city = '';
	protected float $rate = 10.0;
	protected string $name = 'State Tax';
	protected int $priority = 1;
	protected bool $compound = false;
	protected bool $shipping = true;
	protected string $class = '';

	public function forCountry( string $country, string $state = '' ): self {
		$this->country = $country;
		$this->state   = $state;
		return $this;
	}

	public function withRate( float $rate, string $name = 'Sales Tax' ): self {
		$this->rate = $rate;
		$this->name = $name;
		return $this;
	}

	public function compound( bool $is_compound = true ): self {
		$this->compound = $is_compound;
		return $this;
	}

	public function appliesToShipping( bool $applies = true ): self {
		$this->shipping = $applies;
		return $this;
	}

	public function taxClass( string $class ): self {
		$this->class = $class;
		return $this;
	}

	public function forPostcode( string $postcode ): self {
		$this->postcode = $postcode;
		return $this;
	}

	public function forCity( string $city ): self {
		$this->city = $city;
		return $this;
	}

	/**
	 * Save the tax rate and register its ID for safe cleanup.
	 *
	 * @return int Tax rate ID.
	 */
	public function create(): int {
		$rate_data = array(
			'tax_rate_country'  => $this->country,
			'tax_rate_state'    => $this->state,
			'tax_rate'          => (string) $this->rate,
			'tax_rate_name'     => $this->name,
			'tax_rate_priority' => $this->priority,
			'tax_rate_compound' => $this->compound ? 1 : 0,
			'tax_rate_shipping' => $this->shipping ? 1 : 0,
			'tax_rate_order'    => 0,
			'tax_rate_class'    => $this->class,
		);

		if ( function_exists( '_wc_save_tax_rate' ) ) {
			$rate_id = (int) _wc_save_tax_rate( $rate_data );
		} else {
			global $wpdb;
			$wpdb->insert( "{$wpdb->prefix}woocommerce_tax_rates", $rate_data );
			$rate_id = (int) $wpdb->insert_id;
		}

		if ( $rate_id > 0 ) {
			ResourceRegistry::register( 'tax_rate', $rate_id );
			self::save_locations( $rate_id );
		}

		return $rate_id;
	}

	/**
	 * Persist postcode/city locations for the rate.
	 *
	 * Core stores these in `woocommerce_tax_rate_locations`, not in the
	 * rate row, so they must be inserted separately in both CRUD and
	 * raw-$wpdb paths.
	 *
	 * @param int $rate_id
	 * @return void
	 */
	protected function save_locations( int $rate_id ): void {
		$locations = array();
		if ( '' !== $this->postcode ) {
			$locations[] = array(
				'location_code' => $this->postcode,
				'location_type' => 'postcode',
			);
		}
		if ( '' !== $this->city ) {
			$locations[] = array(
				'location_code' => $this->city,
				'location_type' => 'city',
			);
		}
		if ( empty( $locations ) ) {
			return;
		}

		if ( function_exists( 'wc_update_tax_rate_locations' ) ) {
			wc_update_tax_rate_locations( $rate_id, $locations );
			return;
		}

		global $wpdb;
		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) || ! method_exists( $wpdb, 'insert' ) ) {
			return;
		}
		foreach ( $locations as $location ) {
			$wpdb->insert(
				"{$wpdb->prefix}woocommerce_tax_rate_locations",
				array(
					'tax_rate_id'   => $rate_id,
					'location_code' => $location['location_code'],
					'location_type' => $location['location_type'],
				)
			);
		}
	}
}
