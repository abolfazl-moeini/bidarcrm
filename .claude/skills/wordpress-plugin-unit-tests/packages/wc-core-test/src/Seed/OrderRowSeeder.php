<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Seed;

use WPDevTest\Woocommerce\Integration\Datastore\DatastoreMatrix;

/**
 * Direct SQL row seeder for high-volume boundary tests (Rung 3 of Fixture Ladder).
 *
 * Bypasses PHP object instantiation and hooks for lightning-fast database seeding.
 */
class OrderRowSeeder {

	protected int $customer_id = 1;
	protected string $status = 'wc-completed';
	protected float $total = 100.0;
	protected string $currency = 'USD';
	protected string $date_created = '';

	public function __construct() {
		$this->date_created = '';
	}

	public static function new(): self {
		return new self();
	}

	public function withCustomer( int $customer_id ): self {
		$this->customer_id = $customer_id;
		return $this;
	}

	public function withStatus( string $status ): self {
		$this->status = 0 === strpos( $status, 'wc-' ) ? $status : 'wc-' . $status;
		return $this;
	}

	public function withTotal( float $total ): self {
		$this->total = $total;
		return $this;
	}

	/**
	 * Insert raw order row directly into database tables.
	 *
	 * @return int Created Order ID.
	 */
	public function insert(): int {
		global $wpdb;

		$date_created = '' !== $this->date_created ? $this->date_created : current_time( 'mysql' );

		if ( DatastoreMatrix::is_hpos_authoritative() ) {
			if ( ! isset( $wpdb ) || ! is_object( $wpdb ) ) {
				throw new \RuntimeException( 'OrderRowSeeder requires $wpdb to insert raw rows in HPOS mode.' );
			}

			$orders_table = class_exists( '\Automattic\WooCommerce\Internal\DataStores\Orders\OrdersTableDataStore' ) && method_exists( '\Automattic\WooCommerce\Internal\DataStores\Orders\OrdersTableDataStore', 'get_orders_table_name' )
				? \Automattic\WooCommerce\Internal\DataStores\Orders\OrdersTableDataStore::get_orders_table_name()
				: "{$wpdb->prefix}wc_orders";

			$addresses_table = class_exists( '\Automattic\WooCommerce\Internal\DataStores\Orders\OrdersTableDataStore' ) && method_exists( '\Automattic\WooCommerce\Internal\DataStores\Orders\OrdersTableDataStore', 'get_addresses_table_name' )
				? \Automattic\WooCommerce\Internal\DataStores\Orders\OrdersTableDataStore::get_addresses_table_name()
				: "{$wpdb->prefix}wc_order_addresses";

			$wpdb->insert(
				$orders_table,
				array(
					'status'             => $this->status,
					'currency'           => $this->currency,
					'type'               => 'shop_order',
					'tax_amount'         => '0.00',
					'total_amount'       => (string) $this->total,
					'customer_id'        => $this->customer_id,
					'billing_email'      => 'seeder@example.test',
					'date_created_gmt'   => $date_created,
					'date_updated_gmt'   => $date_created,
				)
			);
			$order_id = (int) $wpdb->insert_id;

			if ( $order_id > 0 ) {
				$wpdb->insert(
					$addresses_table,
					array(
						'order_id'     => $order_id,
						'address_type' => 'billing',
						'first_name'   => 'Seeder',
						'last_name'    => 'Customer',
						'email'        => 'seeder@example.test',
					)
				);
				$wpdb->insert(
					$addresses_table,
					array(
						'order_id'     => $order_id,
						'address_type' => 'shipping',
						'first_name'   => 'Seeder',
						'last_name'    => 'Customer',
					)
				);
			}

			return $order_id;
		}

		// Legacy CPT fallback
		$post_id = wp_insert_post(
			array(
				'post_type'   => 'shop_order',
				'post_status' => $this->status,
				'post_date'   => $date_created,
			)
		);

		if ( is_wp_error( $post_id ) || (int) $post_id <= 0 ) {
			throw new \RuntimeException( 'OrderRowSeeder failed to create post for order: ' . ( is_wp_error( $post_id ) ? $post_id->get_error_message() : 'Unknown error' ) );
		}

		update_post_meta( (int) $post_id, '_customer_user', $this->customer_id );
		update_post_meta( (int) $post_id, '_order_total', $this->total );
		update_post_meta( (int) $post_id, '_order_currency', $this->currency );
		update_post_meta( (int) $post_id, '_billing_first_name', 'Seeder' );
		update_post_meta( (int) $post_id, '_billing_last_name', 'Customer' );
		update_post_meta( (int) $post_id, '_billing_email', 'seeder@example.test' );
		update_post_meta( (int) $post_id, '_shipping_first_name', 'Seeder' );
		update_post_meta( (int) $post_id, '_shipping_last_name', 'Customer' );

		return (int) $post_id;
	}
}
