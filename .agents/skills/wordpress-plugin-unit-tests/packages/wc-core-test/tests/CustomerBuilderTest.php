<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\CustomerBuilder;
use WC_Customer;

class CustomerBuilderTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldCreateCustomerWithCustomProfileAndAddresses(): void {
		$customer = CustomerBuilder::new()
			->username( 'sarah_connor' )
			->email( 'sarah@resistance.test' )
			->named( 'Sarah', 'Connor' )
			->withBilling(
				array(
					'city'  => 'Los Angeles',
					'state' => 'CA',
				)
			)
			->withShipping(
				array(
					'city'  => 'Los Angeles',
					'state' => 'CA',
				)
			)
			->create();

		$this->assertInstanceOf( WC_Customer::class, $customer );
		$this->assertSame( 'sarah_connor', $customer->username );
		$this->assertSame( 'sarah@resistance.test', $customer->email );
		$this->assertSame( 'Sarah', $customer->first_name );
		$this->assertSame( 'Connor', $customer->last_name );
		$this->assertSame( 'Los Angeles', $customer->get_billing_city() );
		$this->assertSame( 'CA', $customer->get_billing_state() );
	}
}
