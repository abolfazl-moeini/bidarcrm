<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use PHPUnit\Framework\TestCase;
use WPDevTest\Woocommerce\Integration\Datastore\DatastoreMatrix;
use WPDevTest\Woocommerce\Integration\Datastore\RunsOnDatastoreMatrix;

class DatastoreMatrixTest extends TestCase {
	use RunsOnDatastoreMatrix;

	/**
	 * @test
	 */
	public function itShouldProvideThreeDatastoreModes(): void {
		$matrix = $this->datastore_matrix_provider();

		$this->assertCount( 3, $matrix );
		$this->assertArrayHasKey( 'HPOS Authoritative', $matrix );
		$this->assertArrayHasKey( 'HPOS With Sync', $matrix );
		$this->assertArrayHasKey( 'Legacy CPT', $matrix );
	}

	/**
	 * @test
	 */
	public function itShouldSwitchToHposAuthoritative(): void {
		DatastoreMatrix::switch_to( DatastoreMatrix::HPOS_AUTHORITATIVE );

		$this->assertSame( DatastoreMatrix::HPOS_AUTHORITATIVE, DatastoreMatrix::get_current_mode() );
		$this->assertTrue( DatastoreMatrix::is_hpos_authoritative() );
		$this->assertFalse( DatastoreMatrix::is_sync_enabled() );
		$this->assertFalse( DatastoreMatrix::is_legacy_cpt() );
	}

	/**
	 * @test
	 */
	public function itShouldSwitchToHposWithSync(): void {
		DatastoreMatrix::switch_to( DatastoreMatrix::HPOS_WITH_SYNC );

		$this->assertSame( DatastoreMatrix::HPOS_WITH_SYNC, DatastoreMatrix::get_current_mode() );
		$this->assertTrue( DatastoreMatrix::is_hpos_authoritative() );
		$this->assertTrue( DatastoreMatrix::is_sync_enabled() );
		$this->assertFalse( DatastoreMatrix::is_legacy_cpt() );
	}

	/**
	 * @test
	 */
	public function itShouldSwitchToLegacyCpt(): void {
		DatastoreMatrix::switch_to( DatastoreMatrix::LEGACY_CPT );

		$this->assertSame( DatastoreMatrix::LEGACY_CPT, DatastoreMatrix::get_current_mode() );
		$this->assertFalse( DatastoreMatrix::is_hpos_authoritative() );
		$this->assertFalse( DatastoreMatrix::is_sync_enabled() );
		$this->assertTrue( DatastoreMatrix::is_legacy_cpt() );
	}

	/**
	 * @test
	 */
	public function itShouldApplyModeViaTraitMethod(): void {
		$this->set_datastore_mode( DatastoreMatrix::HPOS_AUTHORITATIVE );
		$this->assertSame( DatastoreMatrix::HPOS_AUTHORITATIVE, DatastoreMatrix::get_current_mode() );

		$this->set_datastore_mode( DatastoreMatrix::LEGACY_CPT );
		$this->assertSame( DatastoreMatrix::LEGACY_CPT, DatastoreMatrix::get_current_mode() );
	}
}
