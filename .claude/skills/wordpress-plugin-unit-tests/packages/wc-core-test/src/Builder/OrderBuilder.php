<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

use WC_Order;
use WC_Product;
use WC_Order_Item_Product;
use WC_Order_Item_Shipping;
use WC_Order_Item_Fee;
use WC_Order_Item_Coupon;

/**
 * Fluent builder for creating WooCommerce orders.
 *
 * Implements the Fixture Ladder: defaults to minimal 1-write order creation,
 * climbing up to full complex orders only when specified.
 */
class OrderBuilder extends AbstractBuilder {

	protected int $customer_id = 0;
	protected string $status = 'pending';
	protected ?string $payment_method = null;
	protected string $payment_method_title = '';
	protected bool $is_paid = false;
	protected ?string $complete_payment_txn = null;

	/** @var array<array{product: WC_Product, qty: int, price: ?float}> */
	protected array $items = array();

	/** @var array<array{name: string, amount: float, taxable: bool}> */
	protected array $fees = array();

	/** @var array<array{code: string, discount: float}> */
	protected array $coupons = array();

	/** @var array{method_id: string, cost: float, title: string}|null */
	protected ?array $shipping = null;

	protected array $billing_address = array();
	protected array $shipping_address = array();
	protected array $meta_data = array();

	public function withCustomer( int $customer_id ): self {
		$this->customer_id = $customer_id;
		return $this;
	}

	public function withStatus( string $status ): self {
		$this->status = $status;
		return $this;
	}

	public function withItem( WC_Product $product, int $qty = 1, ?float $price = null ): self {
		$this->items[] = array(
			'product' => $product,
			'qty'     => $qty,
			'price'   => $price,
		);
		return $this;
	}

	public function withBillingAddress( array $address ): self {
		$this->billing_address = array_merge( $this->billing_address, $address );
		return $this;
	}

	public function withShippingAddress( array $address ): self {
		$this->shipping_address = array_merge( $this->shipping_address, $address );
		return $this;
	}

	public function withShipping( string $method_id = 'flat_rate', float $cost = 10.0, string $title = 'Flat rate' ): self {
		$this->shipping = array(
			'method_id' => $method_id,
			'cost'      => $cost,
			'title'     => $title,
		);
		return $this;
	}

	public function withFee( string $name, float $amount, bool $taxable = false ): self {
		$this->fees[] = array(
			'name'    => $name,
			'amount'  => $amount,
			'taxable' => $taxable,
		);
		return $this;
	}

	public function withCoupon( string $code, float $discount = 0.0 ): self {
		$this->coupons[] = array(
			'code'     => $code,
			'discount' => $discount,
		);
		return $this;
	}

	public function withPaymentMethod( string $method_id, string $title = '' ): self {
		$this->payment_method       = $method_id;
		$this->payment_method_title = '' !== $title ? $title : ucfirst( $method_id );
		return $this;
	}

	public function withMeta( string $key, $value ): self {
		$this->meta_data[ $key ] = $value;
		return $this;
	}

	/**
	 * Mark order as paid cheaply without firing the full payment complete pipeline.
	 */
	public function asPaidState(): self {
		$this->is_paid = true;
		$this->status  = 'processing';
		return $this;
	}

	/**
	 * Trigger the full payment complete pipeline upon creation.
	 */
	public function paymentCompleted( string $txn_id = 'test_txn_123' ): self {
		$this->complete_payment_txn = $txn_id;
		return $this;
	}

	/**
	 * Build and save the order.
	 *
	 * @return WC_Order
	 */
	public function create(): WC_Order {
		$order_args = array(
			'status'      => $this->status,
			'customer_id' => $this->customer_id,
		);

		// Ensure REMOTE_ADDR is set temporarily if needed by wc_create_order
		$original_remote_addr = $_SERVER['REMOTE_ADDR'] ?? null;
		if ( ! isset( $_SERVER['REMOTE_ADDR'] ) ) {
			$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
		}

		try {
			$order = wc_create_order( $order_args );
		} finally {
			if ( null === $original_remote_addr ) {
				unset( $_SERVER['REMOTE_ADDR'] );
			}
		}

		if ( is_wp_error( $order ) ) {
			throw new \RuntimeException( 'OrderBuilder failed to create order: ' . $order->get_error_message() );
		}
		if ( ! $order instanceof WC_Order ) {
			throw new \RuntimeException( 'OrderBuilder expected WC_Order from wc_create_order.' );
		}

		// Add line items
		foreach ( $this->items as $entry ) {
			$product = $entry['product'];
			$qty     = $entry['qty'];
			$price   = $entry['price'] ?? (float) $product->get_price();

			$item = new WC_Order_Item_Product();
			if ( method_exists( $item, 'set_product' ) ) {
				$item->set_product( $product );
			}
			$parent_id = method_exists( $product, 'get_parent_id' ) ? $product->get_parent_id() : 0;
			$is_var    = $parent_id > 0;
			$item->set_props(
				array(
					'product_id'   => $is_var ? $parent_id : $product->get_id(),
					'variation_id' => $is_var ? $product->get_id() : 0,
					'name'         => method_exists( $product, 'get_name' ) ? $product->get_name() : 'Product',
					'quantity'     => $qty,
					'subtotal'     => $price * $qty,
					'total'        => $price * $qty,
				)
			);
			$order->add_item( $item );
		}

		// Add shipping
		if ( null !== $this->shipping ) {
			$shipping_item = new WC_Order_Item_Shipping();
			$shipping_item->set_props(
				array(
					'method_title' => $this->shipping['title'],
					'method_id'    => $this->shipping['method_id'],
					'total'        => (string) $this->shipping['cost'],
				)
			);
			$order->add_item( $shipping_item );
			$order->set_shipping_total( $this->shipping['cost'] );
		}

		// Add fees
		foreach ( $this->fees as $fee ) {
			$fee_item = new WC_Order_Item_Fee();
			$fee_item->set_name( $fee['name'] );
			$fee_item->set_total( (string) $fee['amount'] );
			$order->add_item( $fee_item );
		}

		// Add coupons
		foreach ( $this->coupons as $coupon ) {
			$coupon_item = new WC_Order_Item_Coupon();
			$coupon_item->set_code( $coupon['code'] );
			$coupon_item->set_discount( (string) $coupon['discount'] );
			$order->add_item( $coupon_item );
		}

		// Set addresses
		if ( ! empty( $this->billing_address ) ) {
			$order->set_address( $this->billing_address, 'billing' );
		}
		if ( ! empty( $this->shipping_address ) ) {
			$order->set_address( $this->shipping_address, 'shipping' );
		}

		// Set payment method
		if ( null !== $this->payment_method ) {
			$order->set_payment_method( $this->payment_method );
			$order->set_payment_method_title( $this->payment_method_title );
		}

		// Add metadata
		foreach ( $this->meta_data as $key => $val ) {
			$order->update_meta_data( $key, $val );
		}

		// Calculate or set totals
		if ( ! empty( $this->items ) || null !== $this->shipping || ! empty( $this->fees ) ) {
			$order->calculate_totals( false );
		}

		if ( $this->is_paid ) {
			$order->set_date_paid( time() );
			$order->set_status( 'processing' );
		}

		$order->save();

		if ( null !== $this->complete_payment_txn ) {
			$order->payment_complete( $this->complete_payment_txn );
		}

		return $order;
	}
}
