<?php

namespace WPDevTest\Unit\Http;

use WPDevTest\Http\RecordedRequest;
use WPDevTest\Unit\TestCase;

class TestRecordedRequest extends TestCase {

	public function testUrlParsingAndComponents() {
		$req = new RecordedRequest( 'https://adminapi.tamland.ir:8080/api/v1/courses?season=summer&year=2026#details', [
			'method' => 'POST',
		] );

		$this->assertSame( 'https://adminapi.tamland.ir:8080/api/v1/courses?season=summer&year=2026#details', $req->url() );
		$this->assertSame( 'https://adminapi.tamland.ir:8080/api/v1/courses', $req->cleanUrl() );
		$this->assertSame( 'https', $req->scheme() );
		$this->assertSame( 'adminapi.tamland.ir', $req->host() );
		$this->assertSame( 8080, $req->port() );
		$this->assertSame( '/api/v1/courses', $req->path() );
		$this->assertSame( 'POST', $req->method() );
		$this->assertTrue( $req->isMethod( 'post' ) );
		$this->assertTrue( $req->isMethod( 'POST' ) );
		$this->assertFalse( $req->isMethod( 'GET' ) );
	}

	public function testHeadersCaseInsensitivePerRfc7230() {
		$req = new RecordedRequest( 'https://example.com/api', [
			'headers' => [
				'Content-Type' => 'application/json',
				'Authorization' => 'Bearer token123',
				'X-Custom-Header' => 'CustomValue',
			],
		] );

		// RFC 7230: Content-Type, content-type, CONTENT-TYPE must resolve identically
		$this->assertSame( 'application/json', $req->header( 'Content-Type' ) );
		$this->assertSame( 'application/json', $req->header( 'content-type' ) );
		$this->assertSame( 'application/json', $req->header( 'CONTENT-TYPE' ) );
		$this->assertSame( 'application/json', $req->header( 'CoNtEnT-tYpE' ) );

		$this->assertSame( 'Bearer token123', $req->header( 'authorization' ) );
		$this->assertSame( 'CustomValue', $req->header( 'x-custom-header' ) );
		$this->assertNull( $req->header( 'non-existent' ) );
		$this->assertSame( 'default', $req->header( 'non-existent', 'default' ) );

		$this->assertTrue( $req->hasHeader( 'CONTENT-TYPE' ) );
		$this->assertTrue( $req->hasHeader( 'content-type', 'application/json' ) );
		$this->assertFalse( $req->hasHeader( 'content-type', 'text/html' ) );
		$this->assertFalse( $req->hasHeader( 'non-existent' ) );
	}

	public function testStringHeadersParsing() {
		$headers = "Content-Type: application/json\r\nAuthorization: Bearer xyz\r\n";
		$req = new RecordedRequest( 'https://example.com/api', [
			'headers' => $headers,
		] );

		$this->assertSame( 'application/json', $req->header( 'content-type' ) );
		$this->assertSame( 'Bearer xyz', $req->header( 'authorization' ) );
	}

	public function testQueryParametersAndDotNotation() {
		$req = new RecordedRequest( 'https://example.com/api?season=summer&filter[status]=active&filter[role]=admin' );

		$this->assertSame( 'summer', $req->query( 'season' ) );
		$this->assertSame( 'active', $req->query( 'filter.status' ) );
		$this->assertSame( 'admin', $req->query( 'filter.role' ) );
		$this->assertNull( $req->query( 'non_existent' ) );
		$this->assertSame( 'fallback', $req->query( 'non_existent', 'fallback' ) );

		$this->assertTrue( $req->hasQuery( 'season' ) );
		$this->assertTrue( $req->hasQuery( 'season', 'summer' ) );
		$this->assertFalse( $req->hasQuery( 'season', 'winter' ) );
		$this->assertTrue( $req->hasQuery( 'filter.status', 'active' ) );
	}

	public function testJsonDecodingAndDotNotation() {
		$payload = [
			'Code' => 200,
			'Data' => [
				'STATUS'  => 1,
				'MESSAGE' => 'عملیات با موفقیت انجام شد',
				'user'    => [
					'id'    => 42,
					'name'  => 'John Doe',
				],
			],
		];

		$req = new RecordedRequest( 'https://example.com/api', [
			'method' => 'POST',
			'body'   => json_encode( $payload ),
		] );

		$this->assertSame( $payload, $req->json() );
		$this->assertSame( 200, $req->json( 'Code' ) );
		$this->assertSame( 1, $req->json( 'Data.STATUS' ) );
		$this->assertSame( 'عملیات با موفقیت انجام شد', $req->json( 'Data.MESSAGE' ) );
		$this->assertSame( 42, $req->json( 'Data.user.id' ) );
		$this->assertSame( 'John Doe', $req->json( 'Data.user.name' ) );
		$this->assertNull( $req->json( 'Data.missing' ) );
		$this->assertSame( 'default', $req->json( 'Data.missing', 'default' ) );
	}

	public function testFormDataPayload() {
		$form = [
			'username' => 'john',
			'password' => 'secret',
		];

		$req = new RecordedRequest( 'https://example.com/login', [
			'method' => 'POST',
			'body'   => $form,
		] );

		$this->assertSame( 'username=john&password=secret', $req->body() );
		$this->assertSame( 'john', $req->data( 'username' ) );
		$this->assertSame( 'secret', $req->data( 'password' ) );
		$this->assertSame( $form, $req->rawBody() );
	}

	public function testCookies() {
		$cookies = [
			[ 'name' => 'session_id', 'value' => 'abc123' ],
		];

		$req = new RecordedRequest( 'https://example.com', [
			'cookies' => $cookies,
		] );

		$this->assertSame( $cookies, $req->cookies() );
	}
}
