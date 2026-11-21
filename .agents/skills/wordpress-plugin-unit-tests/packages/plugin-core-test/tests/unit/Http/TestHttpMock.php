<?php

namespace WPDevTest\Unit\Http;

use WPDevTest\Http\Exceptions\AssertionException;
use WPDevTest\Http\Exceptions\StrayRequestException;
use WPDevTest\Http\HttpMock;
use WPDevTest\Http\RecordedRequest;
use WPDevTest\Unit\TestCase;

class TestHttpMock extends TestCase {

	protected function tearDown(): void {
		HttpMock::reset();
		parent::tearDown();
	}

	public function testFakeCatchAllInterceptsOutboundRequests() {
		HttpMock::fake();

		$response = wp_remote_get( 'https://api.example.com/test' );

		$this->assertFalse( is_wp_error( $response ) );
		$this->assertSame( 200, wp_remote_retrieve_response_code( $response ) );
		$this->assertSame( '', wp_remote_retrieve_body( $response ) );

		HttpMock::assertSentCount( 1 );
		HttpMock::assertSent( function ( RecordedRequest $request ) {
			return $request->url() === 'https://api.example.com/test'
				&& $request->method() === 'GET';
		} );
	}

	public function testFakeUrlMapWithJsonPayload() {
		HttpMock::fake( [
			'https://adminapi.tamland.ir/api/payment/savePayment*' => HttpMock::json( [
				'Code' => 200,
				'Data' => [
					'STATUS'  => 1,
					'MESSAGE' => 'عملیات با موفقیت انجام شد',
				],
			], 200 ),
		] );

		$postResponse = wp_remote_post( 'https://adminapi.tamland.ir/api/payment/savePayment?dry_run=0', [
			'headers' => [ 'Content-Type' => 'application/json' ],
			'body'    => json_encode( [ 'Mobile' => '09120000000', 'Amount' => 50000 ] ),
		] );

		$this->assertSame( 200, wp_remote_retrieve_response_code( $postResponse ) );
		$body = json_decode( wp_remote_retrieve_body( $postResponse ), true );
		$this->assertSame( 1, $body['Data']['STATUS'] );
		$this->assertSame( 'عملیات با موفقیت انجام شد', $body['Data']['MESSAGE'] );

		HttpMock::assertSent( function ( RecordedRequest $request ) {
			return strpos( $request->url(), 'savePayment' ) !== false
				&& $request->method() === 'POST'
				&& $request->header( 'content-type' ) === 'application/json'
				&& $request->json( 'Mobile' ) === '09120000000'
				&& $request->json( 'Amount' ) === 50000;
		} );
	}

	public function testFakeWithSequence() {
		HttpMock::fake( [
			'https://example.com/retry' => HttpMock::sequence()
				->push( 'Temporary failure', 503 )
				->push( [ 'status' => 'recovered' ], 200 ),
		] );

		$res1 = wp_remote_get( 'https://example.com/retry' );
		$this->assertSame( 503, wp_remote_retrieve_response_code( $res1 ) );
		$this->assertSame( 'Temporary failure', wp_remote_retrieve_body( $res1 ) );

		$res2 = wp_remote_get( 'https://example.com/retry' );
		$this->assertSame( 200, wp_remote_retrieve_response_code( $res2 ) );
		$body = json_decode( wp_remote_retrieve_body( $res2 ), true );
		$this->assertSame( 'recovered', $body['status'] );

		HttpMock::assertSentCount( 2 );
	}

	public function testFakeWithWpError() {
		HttpMock::fake( [
			'https://example.com/error' => HttpMock::wpError( 'dns_lookup_failed', 'Could not resolve host' ),
		] );

		$response = wp_remote_get( 'https://example.com/error' );

		$this->assertTrue( is_wp_error( $response ) );
		$this->assertSame( 'dns_lookup_failed', $response->get_error_code() );
		$this->assertSame( 'Could not resolve host', $response->get_error_message() );
	}

	public function testPreventStrayRequestsThrowsException() {
		HttpMock::preventStrayRequests();
		HttpMock::fake( [
			'https://authorized.example.com/*' => HttpMock::response( 'OK', 200 ),
		] );

		// Authorized call succeeds
		$res = wp_remote_get( 'https://authorized.example.com/endpoint' );
		$this->assertSame( 200, wp_remote_retrieve_response_code( $res ) );

		// Stray call fails closed
		$this->expectException( StrayRequestException::class );
		$this->expectExceptionMessage( 'Attempted request to [https://unauthorized.external.com/leak] with method [GET] without a matching mock response while stray requests are prevented.' );

		wp_remote_get( 'https://unauthorized.external.com/leak' );
	}

	public function testAssertSentFailureThrowsAssertionException() {
		HttpMock::fake( [
			'https://example.com/*' => HttpMock::response(),
		] );

		wp_remote_get( 'https://example.com/test' );

		$this->expectException( AssertionException::class );
		HttpMock::assertSent( function ( RecordedRequest $req ) {
			return $req->url() === 'https://different.com';
		} );
	}

	public function testAssertNotSent() {
		HttpMock::fake();

		wp_remote_get( 'https://example.com/a' );

		HttpMock::assertNotSent( function ( RecordedRequest $req ) {
			return $req->url() === 'https://example.com/b';
		} );

		$this->expectException( AssertionException::class );
		HttpMock::assertNotSent( function ( RecordedRequest $req ) {
			return $req->url() === 'https://example.com/a';
		} );
	}

	public function testAssertSentCountAndNothingSent() {
		HttpMock::fake();

		HttpMock::assertNothingSent();

		wp_remote_get( 'https://example.com/1' );
		wp_remote_post( 'https://example.com/2' );

		HttpMock::assertSentCount( 2 );

		$this->expectException( AssertionException::class );
		HttpMock::assertSentCount( 5 );
	}

	public function testAssertSentToAndNotSentTo() {
		HttpMock::fake();

		wp_remote_get( 'https://tamland.ir/api/courses?season=summer' );

		HttpMock::assertSentTo( 'https://tamland.ir/api/courses*' );
		HttpMock::assertNotSentTo( 'https://tamland.ir/api/payments*' );
	}

	public function testInspectionHelpers() {
		HttpMock::fake();

		$this->assertFalse( HttpMock::hasRecorded() );
		$this->assertNull( HttpMock::lastRequest() );

		wp_remote_get( 'https://example.com/1' );
		wp_remote_post( 'https://example.com/2' );

		$this->assertTrue( HttpMock::hasRecorded() );
		$this->assertSame( 2, HttpMock::recordedCount() );
		$this->assertSame( 'https://example.com/2', HttpMock::lastRequest()->url() );

		$getRequests = HttpMock::recorded( function ( RecordedRequest $req ) {
			return $req->method() === 'GET';
		} );
		$this->assertCount( 1, $getRequests );
		$this->assertSame( 'https://example.com/1', $getRequests[0]->url() );
	}

	public function testResetRestoresCleanSlate() {
		HttpMock::preventStrayRequests();
		HttpMock::fake( [ '*' => HttpMock::response( 'Mocked' ) ] );

		wp_remote_get( 'https://example.com' );
		$this->assertSame( 1, HttpMock::recordedCount() );

		HttpMock::reset();

		$this->assertSame( 0, HttpMock::recordedCount() );
		$this->assertFalse( HttpMock::isPreventingStrayRequests() );
		HttpMock::assertNothingSent();
	}
}
