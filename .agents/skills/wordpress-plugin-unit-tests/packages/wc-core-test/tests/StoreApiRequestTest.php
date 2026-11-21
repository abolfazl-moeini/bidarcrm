<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Spy\StoreApiRequest;
use WP_REST_Response;

class StoreApiRequestTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldSendGetStoreApiRequestInMemory(): void {
		$response = StoreApiRequest::get( '/wc/store/v1/cart', array( 'currency' => 'USD' ) );

		$this->assertInstanceOf( WP_REST_Response::class, $response );
		$this->assertSame( 200, $response->get_status() );
	}

	/**
	 * @test
	 */
	public function itShouldSendPostStoreApiRequestWithNonceAndBody(): void {
		$response = StoreApiRequest::post(
			'/wc/store/v1/cart/add-item',
			array(
				'id'       => 15,
				'quantity' => 2,
			)
		);

		$this->assertInstanceOf( WP_REST_Response::class, $response );
		$this->assertSame( 200, $response->get_status() );
	}
}
