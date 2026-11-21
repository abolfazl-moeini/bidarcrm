<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

use WC_Customer;

/**
 * Fluent builder for creating WooCommerce test customers.
 */
class CustomerBuilder extends AbstractBuilder {

	protected string $username = '';
	protected string $email = '';
	protected string $password = 'password123';
	protected string $first_name = 'Test';
	protected string $last_name = 'Customer';
	protected array $billing = array();
	protected array $shipping = array();

	public function username( string $username ): self {
		$this->username = $username;
		return $this;
	}

	public function email( string $email ): self {
		$this->email = $email;
		return $this;
	}

	public function password( string $password ): self {
		$this->password = $password;
		return $this;
	}

	public function named( string $first_name, string $last_name = '' ): self {
		$this->first_name = $first_name;
		$this->last_name  = $last_name;
		return $this;
	}

	public function withBilling( array $billing ): self {
		$this->billing = array_merge( $this->billing, $billing );
		return $this;
	}

	public function withShipping( array $shipping ): self {
		$this->shipping = array_merge( $this->shipping, $shipping );
		return $this;
	}

	/**
	 * Build and persist the customer.
	 *
	 * @return WC_Customer
	 */
	public function create(): WC_Customer {
		$suffix   = wp_rand( 1000, 999999 );
		$username = '' !== $this->username ? $this->username : 'customer_' . $suffix;
		$email    = '' !== $this->email ? $this->email : 'customer_' . $suffix . '@example.test';

		$customer = new WC_Customer();
		$customer->set_username( $username );
		$customer->set_email( $email );
		$customer->set_password( $this->password );
		$customer->set_first_name( $this->first_name );
		$customer->set_last_name( $this->last_name );

		$default_billing = array(
			'first_name' => $this->first_name,
			'last_name'  => $this->last_name,
			'address_1'  => '123 Market Street',
			'city'       => 'San Francisco',
			'state'      => 'CA',
			'postcode'   => '94103',
			'country'    => 'US',
			'email'      => $email,
			'phone'      => '555-0100',
		);

		$default_shipping = array(
			'first_name' => $this->first_name,
			'last_name'  => $this->last_name,
			'address_1'  => '123 Market Street',
			'city'       => 'San Francisco',
			'state'      => 'CA',
			'postcode'   => '94103',
			'country'    => 'US',
		);

		$billing  = array_merge( $default_billing, $this->billing );
		$shipping = array_merge( $default_shipping, $this->shipping );

		foreach ( $billing as $key => $val ) {
			$setter = 'set_billing_' . $key;
			if ( method_exists( $customer, $setter ) ) {
				$customer->$setter( $val );
			}
		}

		foreach ( $shipping as $key => $val ) {
			$setter = 'set_shipping_' . $key;
			if ( method_exists( $customer, $setter ) ) {
				$customer->$setter( $val );
			}
		}

		$customer->save();

		return $customer;
	}
}
