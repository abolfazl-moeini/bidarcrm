<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Tests;

use WPDevTest\Woocommerce\Unit\UnitTestCase;
use WPDevTest\Woocommerce\Builder\CouponBuilder;
use WC_Coupon;

class CouponBuilderTest extends UnitTestCase {

	/**
	 * @test
	 */
	public function itShouldCreatePercentageCouponWithLimits(): void {
		$coupon = CouponBuilder::new()
			->code( 'SUMMER20' )
			->percent( 20.0 )
			->freeShipping( true )
			->individualUse( true )
			->minimumSpend( 50.0 )
			->maximumSpend( 500.0 )
			->usageLimit( 100 )
			->usageLimitPerUser( 1 )
			->expiryDate( '2027-12-31' )
			->withProducts( array( 10, 20 ) )
			->withCategories( array( 5 ) )
			->withMeta( '_campaign_id', 'CAMP-777' )
			->create();

		$this->assertInstanceOf( WC_Coupon::class, $coupon );
		$this->assertSame( 'SUMMER20', $coupon->get_code() );
		$this->assertSame( 20.0, $coupon->get_amount() );
		$this->assertSame( 'percent', $coupon->get_discount_type() );
		$this->assertTrue( $coupon->free_shipping );
		$this->assertTrue( $coupon->individual_use );
		$this->assertSame( 50.0, $coupon->minimum_amount );
		$this->assertSame( 500.0, $coupon->maximum_amount );
		$this->assertSame( 100, $coupon->usage_limit );
		$this->assertSame( 1, $coupon->usage_limit_per_user );
		$this->assertSame( '2027-12-31', $coupon->date_expires );
		$this->assertSame( array( 10, 20 ), $coupon->product_ids );
		$this->assertSame( array( 5 ), $coupon->product_categories );
		$this->assertSame( 'CAMP-777', $coupon->meta['_campaign_id'] );
	}

	/**
	 * @test
	 */
	public function itShouldCreateFixedCartAndFixedProductCoupons(): void {
		$fixed_cart = CouponBuilder::new()
			->code( 'FLAT15' )
			->fixedCart( 15.0 )
			->create();

		$this->assertSame( 'fixed_cart', $fixed_cart->get_discount_type() );
		$this->assertSame( 15.0, $fixed_cart->get_amount() );

		$fixed_prod = CouponBuilder::new()
			->code( 'ITEM5' )
			->fixedProduct( 5.0 )
			->create();

		$this->assertSame( 'fixed_product', $fixed_prod->get_discount_type() );
		$this->assertSame( 5.0, $fixed_prod->get_amount() );
	}
}
