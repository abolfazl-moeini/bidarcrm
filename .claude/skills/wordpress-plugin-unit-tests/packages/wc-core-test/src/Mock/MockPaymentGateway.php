<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Mock;

use WC_Payment_Gateway;
use WPDevTest\Woocommerce\State\HookGuard;

if ( ! class_exists( __NAMESPACE__ . '\_BasePaymentGateway', false ) ) {
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		class _BasePaymentGateway {
			public $id;
			public $method_title;
			public $method_description;
			public $title;
			public $has_fields;
			public $supports = array();
			public $enabled;
			public function get_return_url( $order = null ) {
				return 'https://example.test/return';
			}
		}
	} else {
		class_alias( 'WC_Payment_Gateway', __NAMESPACE__ . '\_BasePaymentGateway' );
	}
}

/**
 * Highly configurable mock payment gateway for testing payment processing, failures, and refunds.
 */
class MockPaymentGateway extends _BasePaymentGateway {

	protected string $behavior = 'success';
	protected string $failure_message = 'Payment failed in test environment.';
	protected string $redirect_url = '';
	protected string $transaction_id = 'mock_txn_123';
	protected bool $refund_success = true;

	public function __construct( string $id = 'mock_gateway', string $title = 'Mock Test Gateway' ) {
		$this->id                 = $id;
		$this->method_title       = $title;
		$this->method_description = 'Simulated gateway for unit and integration testing.';
		$this->title              = $title;
		$this->has_fields         = false;
		$this->supports           = array( 'products', 'refunds' );
		$this->enabled            = 'yes';
	}

	public function supportsRefunds( bool $supports = true ): self {
		if ( $supports ) {
			if ( ! in_array( 'refunds', $this->supports, true ) ) {
				$this->supports[] = 'refunds';
			}
		} else {
			$this->supports = array_values( array_diff( $this->supports, array( 'refunds' ) ) );
		}
		return $this;
	}

	public function willRefundSucceed( bool $succeed = true ): self {
		$this->refund_success = $succeed;
		return $this;
	}

	public function willSucceed( string $transaction_id = 'mock_txn_123' ): self {
		$this->behavior       = 'success';
		$this->transaction_id = $transaction_id;
		return $this;
	}

	public function willFail( string $message = 'Payment failed in test environment.' ): self {
		$this->behavior        = 'fail';
		$this->failure_message = $message;
		return $this;
	}

	public function willRedirect( string $url ): self {
		$this->behavior     = 'redirect';
		$this->redirect_url = $url;
		return $this;
	}

	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return array( 'result' => 'fail' );
		}

		if ( 'fail' === $this->behavior ) {
			wc_add_notice( $this->failure_message, 'error' );
			$order->update_status( 'failed', $this->failure_message );
			return array( 'result' => 'fail' );
		}

		$order->payment_complete( $this->transaction_id );

		$redirect = 'redirect' === $this->behavior && '' !== $this->redirect_url
			? $this->redirect_url
			: $this->get_return_url( $order );

		return array(
			'result'   => 'success',
			'redirect' => $redirect,
		);
	}

	public function process_refund( $order_id, $amount = null, $reason = '' ) {
		return $this->refund_success;
	}

	/**
	 * Register this mock gateway into WooCommerce.
	 *
	 * @param string $id
	 * @param string $title
	 * @return self
	 */
	public static function register( string $id = 'mock_gateway', string $title = 'Mock Test Gateway' ): self {
		$instance = new self( $id, $title );

		$callback = function ( $gateways ) use ( $instance ) {
			$gateways[] = $instance;
			return $gateways;
		};

		add_filter( 'woocommerce_payment_gateways', $callback );
		HookGuard::track( 'woocommerce_payment_gateways', $callback );

		// Refresh active gateways in WooCommerce
		if ( function_exists( 'WC' ) && isset( WC()->payment_gateways ) ) {
			WC()->payment_gateways->init();
		}

		return $instance;
	}
}
