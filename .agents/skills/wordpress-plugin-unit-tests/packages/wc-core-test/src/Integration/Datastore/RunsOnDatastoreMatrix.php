<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Integration\Datastore;

/**
 * Trait providing data provider and switches for matrix testing across HPOS and CPT.
 */
trait RunsOnDatastoreMatrix {

	/**
	 * Data provider returning all 3 WooCommerce order datastore states.
	 *
	 * @return array<string, array{string}>
	 */
	public function datastore_matrix_provider(): array {
		return array(
			'HPOS Authoritative' => array( DatastoreMatrix::HPOS_AUTHORITATIVE ),
			'HPOS With Sync'     => array( DatastoreMatrix::HPOS_WITH_SYNC ),
			'Legacy CPT'         => array( DatastoreMatrix::LEGACY_CPT ),
		);
	}

	/**
	 * Apply a datastore mode for the current test.
	 *
	 * @param string $mode
	 * @return void
	 */
	protected function set_datastore_mode( string $mode ): void {
		DatastoreMatrix::switch_to( $mode );
	}
}
