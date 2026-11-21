<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Spy;

use WP_REST_Request;
use WP_REST_Response;
use WPDevTest\Woocommerce\Integration\StorefrontContext;

/**
 * Dispatches authentic Store API requests in-memory via rest_do_request() without external HTTP.
 */
class StoreApiRequest {

	/**
	 * Send a GET request to Store API.
	 *
	 * @param string $endpoint e.g. '/wc/store/v1/cart'
	 * @param array  $params
	 * @return WP_REST_Response
	 */
	public static function get( string $endpoint, array $params = array() ): WP_REST_Response {
		return self::send( 'GET', $endpoint, $params );
	}

	/**
	 * Send a POST request to Store API.
	 *
	 * @param string $endpoint e.g. '/wc/store/v1/cart/add-item'
	 * @param array  $body
	 * @return WP_REST_Response
	 */
	public static function post( string $endpoint, array $body = array() ): WP_REST_Response {
		return self::send( 'POST', $endpoint, $body );
	}

	/**
	 * Dispatch an in-memory REST request to Store API with valid nonces and headers.
	 *
	 * @param string $method
	 * @param string $endpoint
	 * @param array  $data
	 * @return WP_REST_Response
	 */
	public static function send( string $method, string $endpoint, array $data = array() ): WP_REST_Response {
		StorefrontContext::boot();

		$request = new WP_REST_Request( $method, $endpoint );

		// Set Store API nonce. Real Store API clients send `Nonce`; keep the
		// `X-WC-Store-API-Nonce` alias for backwards compatibility.
		$nonce = wp_create_nonce( 'wc_store_api' );
		$request->set_header( 'Nonce', $nonce );
		$request->set_header( 'X-WC-Store-API-Nonce', $nonce );

		// Set cart token if customer has a cart token
		if ( isset( WC()->session ) && method_exists( WC()->session, 'get_customer_id' ) ) {
			$request->set_header( 'Cart-Token', (string) WC()->session->get_customer_id() );
		}

		if ( 'GET' === $method ) {
			$request->set_query_params( $data );
		} else {
			$request->set_header( 'Content-Type', 'application/json' );
			$request->set_body( (string) wp_json_encode( $data ) );
		}

		return rest_do_request( $request );
	}
}
