<?php

namespace WPDevTest\TestCases;

use WPDevTest\Http\HttpMock;
use WPDevTest\Http\Traits\IntersectsHttp;

abstract class HttpTestCase extends TestCase {

	use IntersectsHttp;

	/**
	 * Clean up HTTP mock state in tearDown.
	 */
	protected function tearDown(): void {
		HttpMock::reset();

		parent::tearDown();
	}
}
