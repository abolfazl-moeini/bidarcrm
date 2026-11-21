<?php

namespace WPDevTest\Unit\Http;

use WPDevTest\Http\MockResponse;
use WPDevTest\Unit\TestCase;

class TestMockResponse extends TestCase {

	public function testMakeDefaultResponse() {
		$res = MockResponse::make( 'Hello World' );

		$this->assertSame( 200, $res->status() );
		$this->assertSame( 'OK', $res->statusMessage() );
		$this->assertSame( 'Hello World', $res->body() );
		$this->assertTrue( $res->isOk() );
		$this->assertTrue( $res->isSuccessful() );
		$this->assertFalse( $res->isError() );

		$wp = $res->toWpResponse();
		$this->assertIsArray( $wp );
		$this->assertSame( 200, $wp['response']['code'] );
		$this->assertSame( 'OK', $wp['response']['message'] );
		$this->assertSame( 'Hello World', $wp['body'] );
	}

	public function testJsonResponse() {
		$data = [ 'status' => 'success', 'count' => 5 ];
		$res  = MockResponse::json( $data, 201 );

		$this->assertSame( 201, $res->status() );
		$this->assertSame( 'Created', $res->statusMessage() );
		$this->assertSame( json_encode( $data ), $res->body() );
		$this->assertSame( 'application/json', $res->header( 'content-type' ) );
		$this->assertSame( 'success', $res->decodeJson( 'status' ) );
		$this->assertSame( 5, $res->decodeJson( 'count' ) );

		$wp = $res->toWpResponse();
		$this->assertSame( 201, $wp['response']['code'] );
	}

	public function testEmptyResponse() {
		$res = MockResponse::empty( 204 );

		$this->assertSame( 204, $res->status() );
		$this->assertSame( 'No Content', $res->statusMessage() );
		$this->assertSame( '', $res->body() );
	}

	public function testFailedResponse() {
		$res = MockResponse::failed( 500, 'Server crashed' );

		$this->assertSame( 500, $res->status() );
		$this->assertSame( 'Internal Server Error', $res->statusMessage() );
		$this->assertTrue( $res->isServerError() );
		$this->assertFalse( $res->isOk() );
	}

	public function testWpErrorResponse() {
		$res = MockResponse::wpError( 'invalid_credentials', 'Invalid user credentials.', [ 'attempt' => 3 ] );

		$this->assertTrue( $res->isError() );
		$error = $res->toWpResponse();
		$this->assertTrue( is_wp_error( $error ) );
		$this->assertSame( 'invalid_credentials', $error->get_error_code() );
		$this->assertSame( 'Invalid user credentials.', $error->get_error_message() );
		$this->assertSame( [ 'attempt' => 3 ], $error->get_error_data() );
	}

	public function testFluentModifiers() {
		$res = ( new MockResponse() )
			->withStatus( 302, 'Redirecting' )
			->withHeader( 'Location', 'https://example.com/redirect' )
			->withHeaders( [ 'X-App' => 'WPDev' ] )
			->withBody( 'Redirect' )
			->withCookie( 'test_cookie', 'test_val' );

		$this->assertSame( 302, $res->status() );
		$this->assertSame( 'Redirecting', $res->statusMessage() );
		$this->assertTrue( $res->isRedirect() );
		$this->assertSame( 'https://example.com/redirect', $res->header( 'location' ) );
		$this->assertSame( 'WPDev', $res->header( 'x-app' ) );
		$this->assertCount( 1, $res->cookies() );
		$this->assertSame( 'test_cookie', $res->cookies()[0]['name'] );
	}

	public function testStatusClassifications() {
		$ok = MockResponse::make( '', 200 );
		$this->assertTrue( $ok->isOk() );
		$this->assertFalse( $ok->isRedirect() );
		$this->assertFalse( $ok->isClientError() );
		$this->assertFalse( $ok->isServerError() );

		$redirect = MockResponse::make( '', 301 );
		$this->assertTrue( $redirect->isRedirect() );

		$clientError = MockResponse::make( '', 404 );
		$this->assertTrue( $clientError->isClientError() );

		$serverError = MockResponse::make( '', 503 );
		$this->assertTrue( $serverError->isServerError() );
	}
}
