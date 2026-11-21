<?php

namespace WPDevTest\Unit\Http;

use WPDevTest\Http\Exceptions\SequenceExhaustedException;
use WPDevTest\Http\MockResponse;
use WPDevTest\Http\MockResponseSequence;
use WPDevTest\Unit\TestCase;

class TestMockResponseSequence extends TestCase {

	public function testSequentialPopping() {
		$seq = new MockResponseSequence();
		$seq->push( 'First response', 200 )
			->push( [ 'second' => true ], 201 )
			->pushStatus( 204 );

		$this->assertSame( 3, $seq->count() );
		$this->assertFalse( $seq->isEmpty() );

		// 1st request
		$res1 = $seq->toWpResponse( 'https://example.com/api' );
		$this->assertSame( 'First response', $res1['body'] );
		$this->assertSame( 200, $res1['response']['code'] );
		$this->assertSame( 2, $seq->count() );
		$this->assertSame( 1, $seq->servedCount() );

		// 2nd request
		$res2 = $seq->toWpResponse( 'https://example.com/api' );
		$this->assertSame( json_encode( [ 'second' => true ] ), $res2['body'] );
		$this->assertSame( 201, $res2['response']['code'] );

		// 3rd request
		$res3 = $seq->toWpResponse( 'https://example.com/api' );
		$this->assertSame( '', $res3['body'] );
		$this->assertSame( 204, $res3['response']['code'] );
		$this->assertTrue( $seq->isEmpty() );
		$this->assertSame( 3, $seq->servedCount() );
	}

	public function testSequenceExhaustedThrowsException() {
		$seq = new MockResponseSequence();
		$seq->push( 'Only one' );

		$seq->toWpResponse( 'https://example.com/api' );

		$this->expectException( SequenceExhaustedException::class );
		$this->expectExceptionMessage( '[FATAL] Mock response sequence for [https://example.com/api] exhausted after 1 requests.' );

		$seq->toWpResponse( 'https://example.com/api' );
	}

	public function testFallbackWhenEmpty() {
		$seq = new MockResponseSequence();
		$seq->push( 'Initial' )
			->whenEmpty( MockResponse::make( 'Fallback', 500 ) );

		$res1 = $seq->toWpResponse( 'https://example.com' );
		$this->assertSame( 'Initial', $res1['body'] );

		// Subsequent requests should return fallback indefinitely
		$res2 = $seq->toWpResponse( 'https://example.com' );
		$this->assertSame( 'Fallback', $res2['body'] );
		$this->assertSame( 500, $res2['response']['code'] );

		$res3 = $seq->toWpResponse( 'https://example.com' );
		$this->assertSame( 'Fallback', $res3['body'] );
	}

	public function testDontFailWhenEmpty() {
		$seq = new MockResponseSequence();
		$seq->push( 'Once' )
			->dontFailWhenEmpty();

		$res1 = $seq->toWpResponse( 'https://example.com' );
		$this->assertSame( 'Once', $res1['body'] );

		$res2 = $seq->toWpResponse( 'https://example.com' );
		$this->assertSame( '', $res2['body'] );
		$this->assertSame( 200, $res2['response']['code'] );
	}

	public function testPushWpError() {
		$seq = new MockResponseSequence();
		$seq->push( MockResponse::wpError( 'network_err', 'Connection lost' ) );

		$res = $seq->toWpResponse( 'https://example.com' );
		$this->assertTrue( is_wp_error( $res ) );
		$this->assertSame( 'network_err', $res->get_error_code() );
	}
}
