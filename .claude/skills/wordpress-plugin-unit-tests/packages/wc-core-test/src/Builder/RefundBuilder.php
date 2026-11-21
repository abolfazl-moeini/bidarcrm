<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

use WC_Order;
use WC_Order_Refund;

/**
 * Fluent builder for creating order refunds in WooCommerce.
 */
class RefundBuilder extends AbstractBuilder {

	protected ?WC_Order $order = null;
	protected float $amount = 0.0;
	protected string $reason = 'Test refund';
	protected bool $restock_items = false;
	protected array $line_items = array();

	public function forOrder( WC_Order $order ): self {
		$this->order = $order;
		return $this;
	}

	public function amount( float $amount ): self {
		$this->amount = $amount;
		return $this;
	}

	public function reason( string $reason ): self {
		$this->reason = $reason;
		return $this;
	}

	public function restock( bool $restock = true ): self {
		$this->restock_items = $restock;
		return $this;
	}

	public function withLineItem( int $item_id, int $qty, float $refund_total = 0.0, float $refund_tax = 0.0 ): self {
		$this->line_items[ $item_id ] = array(
			'qty'          => $qty,
			'refund_total' => $refund_total,
			'refund_tax'   => array( $refund_tax ),
		);
		return $this;
	}

	/**
	 * Create and persist the refund for the order.
	 *
	 * @return WC_Order_Refund
	 */
	public function create(): WC_Order_Refund {
		if ( null === $this->order ) {
			throw new \InvalidArgumentException( 'Cannot create a refund without an associated WC_Order.' );
		}

		$amount = $this->amount > 0 ? $this->amount : (float) $this->order->get_total();

		$refund = wc_create_refund(
			array(
				'amount'         => (string) $amount,
				'reason'         => $this->reason,
				'order_id'       => $this->order->get_id(),
				'line_items'     => $this->line_items,
				'restock_items'  => $this->restock_items,
			)
		);

		if ( is_wp_error( $refund ) ) {
			throw new \RuntimeException( 'Failed to create refund: ' . $refund->get_error_message() );
		}

		return $refund;
	}
}
