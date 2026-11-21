<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Spy\EmailSpy;
use WPDevTest\Woocommerce\State\HookGuard;

class EmailSpyTest extends UnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		EmailSpy::reset();
	}

	protected function tearDown(): void {
		EmailSpy::reset();
		HookGuard::restore();
		parent::tearDown();
	}

	/**
	 * @test
	 */
	public function itShouldStartEmptyAndAssertNoEmailsSent(): void {
		EmailSpy::start();
		EmailSpy::assertNoEmailsSent();
		$this->assertEmpty( EmailSpy::getEmails() );
	}

	/**
	 * @test
	 */
	public function itShouldCaptureEmailsDispatchedViaPreWpMail(): void {
		EmailSpy::start();

		$email_args = array(
			'to'          => 'customer@example.test',
			'subject'     => 'Order #123 Confirmed',
			'message'     => 'Thank you for your order.',
			'headers'     => array(),
			'attachments' => array(),
		);

		apply_filters( 'pre_wp_mail', null, $email_args );

		$this->assertCount( 1, EmailSpy::getEmails() );
		EmailSpy::assertEmailSent( 'customer@example.test' );
		EmailSpy::assertEmailSent( 'customer@example.test', 'Order #123' );
	}

	/**
	 * @test
	 */
	public function itShouldCaptureFiredWooCommerceEmailActions(): void {
		EmailSpy::start();

		do_action( 'woocommerce_order_status_pending_to_processing_notification' );

		EmailSpy::assertEmailActionTriggered( 'woocommerce_order_status_pending_to_processing_notification' );
		EmailSpy::assertEmailActionNotTriggered( 'woocommerce_order_status_pending_to_completed_notification' );
		$this->assertContains( 'woocommerce_order_status_pending_to_processing_notification', EmailSpy::getEmailActions() );
	}

	/**
	 * @test
	 */
	public function itShouldResetCapturedData(): void {
		EmailSpy::start();
		apply_filters( 'pre_wp_mail', null, array( 'to' => 'user@test.org', 'subject' => 'Hi' ) );
		$this->assertCount( 1, EmailSpy::getEmails() );

		EmailSpy::reset();
		$this->assertEmpty( EmailSpy::getEmails() );
		$this->assertEmpty( EmailSpy::getEmailActions() );
	}

	/**
	 * @test
	 */
	public function itShouldStopListeningWhenStopCalled(): void {
		EmailSpy::start();
		EmailSpy::stop();

		apply_filters( 'pre_wp_mail', null, array( 'to' => 'ghost@test.org', 'subject' => 'Boo' ) );
		$this->assertEmpty( EmailSpy::getEmails() );
	}

	/**
	 * @test
	 */
	public function itShouldReattachCleanlyAcrossConsecutiveStartCallsWithoutHookGuardInterference(): void {
		// Simulate Session 1
		EmailSpy::start();
		apply_filters( 'pre_wp_mail', null, array( 'to' => 'first@test.org', 'subject' => 'One' ) );
		$this->assertCount( 1, EmailSpy::getEmails() );

		// Simulate external teardown unhooking filters via HookGuard
		HookGuard::restore();

		// Session 2 should cleanly re-attach hooks despite HookGuard having cleared previous ones
		EmailSpy::start();
		$this->assertEmpty( EmailSpy::getEmails() );

		apply_filters( 'pre_wp_mail', null, array( 'to' => 'second@test.org', 'subject' => 'Two' ) );
		$this->assertCount( 1, EmailSpy::getEmails() );
		EmailSpy::assertEmailSent( 'second@test.org', 'Two' );
	}
}
