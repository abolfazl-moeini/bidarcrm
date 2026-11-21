<?php

namespace WPDevTest\Unit\Http;

use WPDevTest\Http\HttpMock;
use WPDevTest\Http\RecordedRequest;
use WPDevTest\TestCases\HttpTestCase;

class TestHttpTestCaseIsolation extends HttpTestCase {

	public function testFirstMethodArmsMockAndRecordsRequest() {
		// When test starts, clean state must be guaranteed
		$this->assertNothingHttpSent();
		$this->assertSame( 0, HttpMock::recordedCount() );

		$this->fakeHttp( [
			'https://api.tamland.ir/v1/*' => HttpMock::json( [ 'step' => 1 ] ),
		] );

		$res = wp_remote_get( 'https://api.tamland.ir/v1/test' );
		$this->assertSame( 200, wp_remote_retrieve_response_code( $res ) );

		$this->assertHttpSent( function ( RecordedRequest $req ) {
			return $req->url() === 'https://api.tamland.ir/v1/test';
		} );
		$this->assertSame( 1, HttpMock::recordedCount() );
	}

	public function testSecondMethodHasZeroLeakageFromFirstMethod() {
		// Even after testFirstMethodArmsMockAndRecordsRequest ran,
		// IntersectsHttp @after / tearDown MUST guarantee clean slate!
		$this->assertNothingHttpSent();
		$this->assertSame( 0, HttpMock::recordedCount() );
		$this->assertFalse( HttpMock::isPreventingStrayRequests() );

		// Set up different mock
		$this->fakeHttp( [
			'https://api.tamland.ir/v2/*' => HttpMock::json( [ 'step' => 2 ] ),
		] );

		$res = wp_remote_get( 'https://api.tamland.ir/v2/test' );
		$this->assertSame( 200, wp_remote_retrieve_response_code( $res ) );

		$this->assertHttpSent( function ( RecordedRequest $req ) {
			return $req->url() === 'https://api.tamland.ir/v2/test';
		} );
		$this->assertSame( 1, HttpMock::recordedCount() );
	}

	public function testThirdMethodVerifiesConvenienceMethods() {
		$this->assertNothingHttpSent();

		$this->preventStrayHttp();
		$this->assertTrue( HttpMock::isPreventingStrayRequests() );

		$this->fakeHttp( [
			'https://api.example.com/*' => HttpMock::response( 'PONG', 200 ),
		] );

		$res = wp_remote_get( 'https://api.example.com/ping' );
		$this->assertSame( 'PONG', wp_remote_retrieve_body( $res ) );

		$this->assertHttpSent( function ( RecordedRequest $req ) {
			return $req->url() === 'https://api.example.com/ping';
		} );
		$this->assertHttpNotSent( function ( RecordedRequest $req ) {
			return $req->url() === 'https://api.example.com/pong';
		} );
	}
}
