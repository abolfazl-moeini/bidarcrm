<?php

namespace WPDevTest\Unit\Http;

use WPDevTest\Http\RecordedRequest;
use WPDevTest\Http\RequestMatcher;
use WPDevTest\Unit\TestCase;

class TestRequestMatcher extends TestCase {

	public function testCatchAllWildcard() {
		$req = new RecordedRequest( 'https://adminapi.tamland.ir/api/payment/savePayment' );

		$this->assertTrue( RequestMatcher::matches( '*', $req ) );
	}

	public function testWildcardMatchesPathRegardlessOfAppendedQueryString() {
		// P2.2: Wildcards (https://adminapi.tamland.ir/api/course/*) match paths regardless of appended query strings
		$pattern = 'https://adminapi.tamland.ir/api/course/*';

		$reqWithQuery = new RecordedRequest( 'https://adminapi.tamland.ir/api/course/123?season=summer&limit=10' );
		$this->assertTrue( RequestMatcher::matches( $pattern, $reqWithQuery ) );

		$reqWithoutQuery = new RecordedRequest( 'https://adminapi.tamland.ir/api/course/123' );
		$this->assertTrue( RequestMatcher::matches( $pattern, $reqWithoutQuery ) );

		$reqDifferentPath = new RecordedRequest( 'https://adminapi.tamland.ir/api/user/123?season=summer' );
		$this->assertFalse( RequestMatcher::matches( $pattern, $reqDifferentPath ) );
	}

	public function testWildcardPatternWithAsterisks() {
		$pattern = '*savePayment*';

		$req = new RecordedRequest( 'https://adminapi.tamland.ir/api/payment/savePayment?dry_run=1' );
		$this->assertTrue( RequestMatcher::matches( $pattern, $req ) );

		$req2 = new RecordedRequest( 'https://otherapi.com/savePayment' );
		$this->assertTrue( RequestMatcher::matches( $pattern, $req2 ) );

		$req3 = new RecordedRequest( 'https://otherapi.com/processOrder' );
		$this->assertFalse( RequestMatcher::matches( $pattern, $req3 ) );
	}

	public function testExactUrlMatchingWithQueryNormalization() {
		// P2.2: Exact URL matching normalizes and sorts query keys:
		// https://adminapi.tamland.ir/api/course?b=2&a=1 matches https://adminapi.tamland.ir/api/course?a=1&b=2
		$pattern = 'https://adminapi.tamland.ir/api/course?b=2&a=1';

		$reqReversedKeys = new RecordedRequest( 'https://adminapi.tamland.ir/api/course?a=1&b=2' );
		$this->assertTrue( RequestMatcher::matches( $pattern, $reqReversedKeys ) );

		$reqMatchingKeys = new RecordedRequest( 'https://adminapi.tamland.ir/api/course?b=2&a=1' );
		$this->assertTrue( RequestMatcher::matches( $pattern, $reqMatchingKeys ) );

		$reqDifferentValue = new RecordedRequest( 'https://adminapi.tamland.ir/api/course?a=99&b=2' );
		$this->assertFalse( RequestMatcher::matches( $pattern, $reqDifferentValue ) );

		$reqMissingKey = new RecordedRequest( 'https://adminapi.tamland.ir/api/course?a=1' );
		$this->assertFalse( RequestMatcher::matches( $pattern, $reqMissingKey ) );
	}

	public function testNestedQueryArrayNormalization() {
		$pattern = 'https://example.com/api?filter[role]=admin&filter[status]=active';
		$actual  = new RecordedRequest( 'https://example.com/api?filter[status]=active&filter[role]=admin' );

		$this->assertTrue( RequestMatcher::matches( $pattern, $actual ) );
	}

	public function testSchemeAgnosticMatching() {
		$pattern = 'adminapi.tamland.ir/api/course';

		$reqHttps = new RecordedRequest( 'https://adminapi.tamland.ir/api/course' );
		$reqHttp  = new RecordedRequest( 'http://adminapi.tamland.ir/api/course' );

		$this->assertTrue( RequestMatcher::matches( $pattern, $reqHttps ) );
		$this->assertTrue( RequestMatcher::matches( $pattern, $reqHttp ) );
	}

	public function testTrailingSlashNormalization() {
		$pattern = 'https://example.com/api/users';
		$req = new RecordedRequest( 'https://example.com/api/users/' );

		$this->assertTrue( RequestMatcher::matches( $pattern, $req ) );
	}

	public function testRegexMatching() {
		$pattern = '#^https://adminapi\.tamland\.ir/api/v\d+/order/\d+$#';

		$validReq = new RecordedRequest( 'https://adminapi.tamland.ir/api/v1/order/456' );
		$invalidReq = new RecordedRequest( 'https://adminapi.tamland.ir/api/v1/order/abc' );

		$this->assertTrue( RequestMatcher::matches( $pattern, $validReq ) );
		$this->assertFalse( RequestMatcher::matches( $pattern, $invalidReq ) );
	}

	public function testCallableMatcher() {
		$pattern = function ( RecordedRequest $request ) {
			return $request->method() === 'POST' && $request->query( 'sync' ) === 'true';
		};

		$matchedReq = new RecordedRequest( 'https://example.com/api?sync=true', [ 'method' => 'POST' ] );
		$unmatchedReq = new RecordedRequest( 'https://example.com/api?sync=false', [ 'method' => 'POST' ] );
		$unmatchedMethod = new RecordedRequest( 'https://example.com/api?sync=true', [ 'method' => 'GET' ] );

		$this->assertTrue( RequestMatcher::matches( $pattern, $matchedReq ) );
		$this->assertFalse( RequestMatcher::matches( $pattern, $unmatchedReq ) );
		$this->assertFalse( RequestMatcher::matches( $pattern, $unmatchedMethod ) );
	}
}
