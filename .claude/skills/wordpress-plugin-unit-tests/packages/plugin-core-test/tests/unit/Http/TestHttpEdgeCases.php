<?php

namespace WPDevTest\Unit\Http;

use WPDevTest\Http\Exceptions\AssertionException;
use WPDevTest\Http\Exceptions\SequenceExhaustedException;
use WPDevTest\Http\Exceptions\StrayRequestException;
use WPDevTest\Http\HttpMock;
use WPDevTest\Http\MockResponse;
use WPDevTest\Http\MockResponseSequence;
use WPDevTest\Http\RecordedRequest;
use WPDevTest\Http\RequestMatcher;
use WPDevTest\Http\Traits\IntersectsHttp;
use WPDevTest\Unit\TestCase;

class TestHttpEdgeCases extends TestCase {

	use IntersectsHttp;

	public function testEmptyUrlAndMalformedInputs() {
		$req = new RecordedRequest( '', [ 'method' => '' ] );
		$this->assertSame( '', $req->url() );
		$this->assertSame( 'GET', $req->method() );
		$this->assertSame( [], $req->headers() );
		$this->assertSame( '', $req->body() );
		$this->assertSame( [], $req->json() );
		$this->assertNull( $req->json( 'some_key' ) );
	}

	public function testPersianAndUnicodePayloads() {
		$persianText = 'ثبت نام دوره تابستان با موفقیت انجام شد';
		$url         = 'https://adminapi.tamland.ir/api/course?title=' . urlencode( 'دوره ریاضی' );

		HttpMock::fake( [
			'https://adminapi.tamland.ir/api/course*' => HttpMock::json( [
				'message' => $persianText,
			] ),
		] );

		$res = wp_remote_get( $url );
		$this->assertSame( 200, wp_remote_retrieve_response_code( $res ) );
		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		$this->assertSame( $persianText, $data['message'] );

		HttpMock::assertSent( function ( RecordedRequest $req ) use ( $persianText ) {
			return $req->query( 'title' ) === 'دوره ریاضی';
		} );
	}

	public function testSequenceWithZeroResponsesThrowsImmediately() {
		$seq = new MockResponseSequence();

		$this->expectException( SequenceExhaustedException::class );
		$seq->toWpResponse( 'https://empty.seq' );
	}

	public function testCallableMatcherReturningNullFallsThrough() {
		HttpMock::preventStrayRequests();
		HttpMock::fake( [
			'https://api.example.com/*' => function ( RecordedRequest $req ) {
				// Only handle if query has 'handle_me=1'
				if ( $req->query( 'handle_me' ) === '1' ) {
					return HttpMock::response( 'Handled' );
				}
				return null; // fall through
			},
			'https://api.example.com/fallback' => HttpMock::response( 'Fallback Handled' ),
		] );

		// 1. Should be handled by first callable
		$res1 = wp_remote_get( 'https://api.example.com/any?handle_me=1' );
		$this->assertSame( 'Handled', wp_remote_retrieve_body( $res1 ) );

		// 2. Not handled by callable, but matches second rule
		$res2 = wp_remote_get( 'https://api.example.com/fallback?handle_me=0' );
		$this->assertSame( 'Fallback Handled', wp_remote_retrieve_body( $res2 ) );

		// 3. Not handled by callable and no other rule -> stray exception
		$this->expectException( StrayRequestException::class );
		wp_remote_get( 'https://api.example.com/unmatched?handle_me=0' );
	}

	public function testRepeatedResetIsIdempotent() {
		HttpMock::reset();
		HttpMock::reset();
		HttpMock::reset();

		$this->assertFalse( HttpMock::isPreventingStrayRequests() );
		$this->assertSame( 0, HttpMock::recordedCount() );
	}

	public function testAssertSentToWithCallbackFailure() {
		HttpMock::fake();

		wp_remote_post( 'https://api.example.com/users', [
			'body' => json_encode( [ 'role' => 'subscriber' ] ),
		] );

		$this->expectException( AssertionException::class );
		// URL matches, but callback returns false
		HttpMock::assertSentTo( 'https://api.example.com/users', function ( RecordedRequest $req ) {
			return $req->json( 'role' ) === 'administrator';
		} );
	}

	public function testQueryNormalizationWithSpecialCharactersAndEntities() {
		$url1 = 'https://example.com/api?tag=' . urlencode( 'c++ & php' ) . '&sort=desc';
		$url2 = 'https://example.com/api?sort=desc&tag=' . urlencode( 'c++ & php' );

		$req = new RecordedRequest( $url2 );
		$this->assertTrue( RequestMatcher::matches( $url1, $req ) );
	}

	public function testSpecificUrlPrecedenceOverCatchAllWildcard() {
		HttpMock::fake( [
			'*'                             => HttpMock::response( 'catch-all' ),
			'https://example.com/api/users' => HttpMock::json( [ 'id' => 1 ] ),
		] );

		$resSpecific = wp_remote_get( 'https://example.com/api/users' );
		$resCatchAll = wp_remote_get( 'https://example.com/other' );

		$this->assertSame( '{"id":1}', wp_remote_retrieve_body( $resSpecific ) );
		$this->assertSame( 'catch-all', wp_remote_retrieve_body( $resCatchAll ) );
	}

	public function testSetUpFakeFollowedByTestSpecificFake() {
		// Simulates setUp() calling fake() default 200 catch-all
		HttpMock::fake();

		// Simulates specific test method overriding a specific URL
		HttpMock::fake( [
			'https://api.example.com/data' => HttpMock::response( 'my-data' ),
		] );

		$resSpecific = wp_remote_get( 'https://api.example.com/data' );
		$resOther    = wp_remote_get( 'https://api.example.com/other' );

		$this->assertSame( 'my-data', wp_remote_retrieve_body( $resSpecific ) );
		$this->assertSame( 200, wp_remote_retrieve_response_code( $resOther ) );
	}

	public function testIndexedArrayOfCallbacksInFake() {
		HttpMock::fake( [
			function ( RecordedRequest $req ) {
				return $req->url() === 'https://custom.com/hook'
					? HttpMock::response( 'custom-ok' )
					: null;
			},
		] );

		$res = wp_remote_get( 'https://custom.com/hook' );
		$this->assertSame( 'custom-ok', wp_remote_retrieve_body( $res ) );
	}

	public function testMockResponseSequenceWithClosure() {
		$seq = new MockResponseSequence();
		$seq->push( function () {
			return HttpMock::response( 'first-queued' );
		} );
		$seq->whenEmpty( function () {
			return HttpMock::response( 'dynamic-fallback' );
		} );

		$res1 = $seq->toWpResponse();
		$res2 = $seq->toWpResponse();

		$this->assertSame( 'first-queued', $res1['body'] );
		$this->assertSame( 'dynamic-fallback', $res2['body'] );
	}

	public function testRootDomainTrailingSlashNormalization() {
		$reqWithSlash    = new RecordedRequest( 'https://example.com/' );
		$reqWithoutSlash = new RecordedRequest( 'https://example.com' );

		$this->assertTrue( RequestMatcher::matches( 'https://example.com', $reqWithSlash ) );
		$this->assertTrue( RequestMatcher::matches( 'https://example.com/', $reqWithoutSlash ) );
		$this->assertTrue( RequestMatcher::matches( 'https://example.com/', $reqWithSlash ) );
		$this->assertTrue( RequestMatcher::matches( 'https://example.com', $reqWithoutSlash ) );
	}

	public function testPersianQueryParametersInPattern() {
		$req = new RecordedRequest( 'https://example.com/api?search=' . urlencode( 'ریاضی' ) );
		$this->assertTrue( RequestMatcher::matches( 'https://example.com/api?search=ریاضی', $req ) );
	}

	public function testQueryParameterWildcardValue() {
		$req = new RecordedRequest( 'https://example.com/api?token=secret123&action=export_pdf' );
		$this->assertTrue( RequestMatcher::matches( '*?token=*', $req ) );
		$this->assertTrue( RequestMatcher::matches( '*?action=export_*', $req ) );
		$this->assertFalse( RequestMatcher::matches( '*?token=wrong', $req ) );
	}

	public function testMockResponseJsonDoesNotDuplicateContentType() {
		$res = MockResponse::json( [ 'ok' => true ], 200, [ 'content-type' => 'application/problem+json' ] );
		$headers = $res->headers();
		$this->assertCount( 1, $headers );
		$this->assertSame( 'application/problem+json', $res->header( 'content-type' ) );
	}

	public function testAssertSentAndNotSentAcceptStringUrlPattern() {
		HttpMock::fake();

		wp_remote_get( 'https://example.com/users/123' );

		HttpMock::assertSent( 'https://example.com/users/*' );
		HttpMock::assertNotSent( 'https://example.com/posts/*' );
	}

	public function testAssertSentCountWithPatternOrCallback() {
		HttpMock::fake();

		wp_remote_get( 'https://example.com/users/1' );
		wp_remote_get( 'https://example.com/users/2' );
		wp_remote_get( 'https://example.com/posts/1' );

		HttpMock::assertSentCount( 3 );
		HttpMock::assertSentCount( 2, 'https://example.com/users/*' );
		HttpMock::assertSentCount( 1, 'https://example.com/posts/*' );
		HttpMock::assertSentCount( 2, function ( RecordedRequest $req ) {
			return strpos( $req->url(), '/users/' ) !== false;
		} );
	}

	public function testFileStreamingWritesBodyToDisk() {
		$tmp = tempnam( sys_get_temp_dir(), 'test_dl_' );
		HttpMock::fake( [
			'https://example.com/download.zip' => HttpMock::response( 'FILE_CONTENT_XYZ' ),
		] );

		$res = wp_remote_get( 'https://example.com/download.zip', [
			'stream'   => true,
			'filename' => $tmp,
		] );

		$this->assertSame( 'FILE_CONTENT_XYZ', file_get_contents( $tmp ) );
		$this->assertSame( $tmp, $res['filename'] );

		@unlink( $tmp );
	}

	public function testRecordedRequestVerbHelpersAndIsJson() {
		$req = new RecordedRequest( 'https://example.com', [
			'method'  => 'POST',
			'headers' => [ 'Content-Type' => 'application/json' ],
		] );

		$this->assertTrue( $req->isPost() );
		$this->assertFalse( $req->isGet() );
		$this->assertFalse( $req->isPut() );
		$this->assertFalse( $req->isPatch() );
		$this->assertFalse( $req->isDelete() );
		$this->assertFalse( $req->isHead() );
		$this->assertTrue( $req->isJson() );
		$this->assertSame( 'POST', $req->method() );
	}
}
