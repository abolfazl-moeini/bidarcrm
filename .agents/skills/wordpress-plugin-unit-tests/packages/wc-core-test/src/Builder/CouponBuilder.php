<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

use WC_Coupon;

/**
 * Fluent builder for creating WooCommerce coupons using modern WC_Coupon CRUD.
 */
class CouponBuilder extends AbstractBuilder {

	protected string $code = 'dummycoupon';
	protected float $amount = 10.0;
	protected string $discount_type = 'fixed_cart';
	protected bool $free_shipping = false;
	protected bool $individual_use = false;
	protected bool $exclude_sale_items = false;
	protected float $minimum_amount = 0.0;
	protected float $maximum_amount = 0.0;
	protected array $product_ids = array();
	protected array $excluded_product_ids = array();
	protected array $product_categories = array();
	protected array $excluded_product_categories = array();
	protected int $usage_limit = 0;
	protected int $usage_limit_per_user = 0;
	protected ?string $expiry_date = null;
	protected array $meta_data = array();

	public function code( string $code ): self {
		$this->code = $code;
		return $this;
	}

	public function amount( float $amount ): self {
		$this->amount = $amount;
		return $this;
	}

	public function discountType( string $type ): self {
		$this->discount_type = $type;
		return $this;
	}

	public function percent( float $percent ): self {
		$this->discount_type = 'percent';
		$this->amount        = $percent;
		return $this;
	}

	public function fixedCart( float $amount ): self {
		$this->discount_type = 'fixed_cart';
		$this->amount        = $amount;
		return $this;
	}

	public function fixedProduct( float $amount ): self {
		$this->discount_type = 'fixed_product';
		$this->amount        = $amount;
		return $this;
	}

	public function freeShipping( bool $free = true ): self {
		$this->free_shipping = $free;
		return $this;
	}

	public function individualUse( bool $individual = true ): self {
		$this->individual_use = $individual;
		return $this;
	}

	public function minimumSpend( float $min ): self {
		$this->minimum_amount = $min;
		return $this;
	}

	public function maximumSpend( float $max ): self {
		$this->maximum_amount = $max;
		return $this;
	}

	public function withProducts( array $product_ids ): self {
		$this->product_ids = array_map( 'intval', $product_ids );
		return $this;
	}

	public function excludeProducts( array $product_ids ): self {
		$this->excluded_product_ids = array_map( 'intval', $product_ids );
		return $this;
	}

	public function withCategories( array $category_ids ): self {
		$this->product_categories = array_map( 'intval', $category_ids );
		return $this;
	}

	public function excludeCategories( array $category_ids ): self {
		$this->excluded_product_categories = array_map( 'intval', $category_ids );
		return $this;
	}

	public function usageLimit( int $limit ): self {
		$this->usage_limit = $limit;
		return $this;
	}

	public function usageLimitPerUser( int $limit ): self {
		$this->usage_limit_per_user = $limit;
		return $this;
	}

	public function expiryDate( string $date ): self {
		$this->expiry_date = $date;
		return $this;
	}

	public function withMeta( string $key, $value ): self {
		$this->meta_data[ $key ] = $value;
		return $this;
	}

	/**
	 * Build and persist the coupon.
	 *
	 * @return WC_Coupon
	 */
	public function create(): WC_Coupon {
		$coupon = new WC_Coupon();
		$coupon->set_code( $this->code );
		$coupon->set_amount( $this->amount );
		$coupon->set_discount_type( $this->discount_type );
		$coupon->set_free_shipping( $this->free_shipping );
		$coupon->set_individual_use( $this->individual_use );
		$coupon->set_exclude_sale_items( $this->exclude_sale_items );

		if ( $this->minimum_amount > 0 ) {
			$coupon->set_minimum_amount( $this->minimum_amount );
		}
		if ( $this->maximum_amount > 0 ) {
			$coupon->set_maximum_amount( $this->maximum_amount );
		}
		if ( ! empty( $this->product_ids ) ) {
			$coupon->set_product_ids( $this->product_ids );
		}
		if ( ! empty( $this->excluded_product_ids ) ) {
			$coupon->set_excluded_product_ids( $this->excluded_product_ids );
		}
		if ( ! empty( $this->product_categories ) ) {
			$coupon->set_product_categories( $this->product_categories );
		}
		if ( ! empty( $this->excluded_product_categories ) ) {
			$coupon->set_excluded_product_categories( $this->excluded_product_categories );
		}
		if ( $this->usage_limit > 0 ) {
			$coupon->set_usage_limit( $this->usage_limit );
		}
		if ( $this->usage_limit_per_user > 0 ) {
			$coupon->set_usage_limit_per_user( $this->usage_limit_per_user );
		}
		if ( null !== $this->expiry_date ) {
			$coupon->set_date_expires( $this->expiry_date );
		}

		foreach ( $this->meta_data as $key => $val ) {
			$coupon->update_meta_data( $key, $val );
		}

		$coupon->save();

		return $coupon;
	}
}
