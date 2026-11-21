<?php

namespace WPDevTest\Woocommerce;

if ( ! class_exists( 'WC_Payment_Token' ) ) {
	class _BasePaymentToken {
		public $id = 0;
		public $meta = array();
		public function get_id() { return $this->id; }
		public function get_meta( $key ) { return $this->meta[ $key ] ?? null; }
		public function add_meta_data( $key, $val, $single = false ) { $this->meta[ $key ] = $val; }
		public function save() { return $this->id; }
		public function delete( $force = true ) { return true; }
	}
} else {
	class_alias( 'WC_Payment_Token', __NAMESPACE__ . '\_BasePaymentToken' );
}

/**
 * Stub/Dummy class to test WC_Payment_Token methods only
 *
 * @since 2.6.0
 */
class TokenStub extends _BasePaymentToken {

	/** @protected string Token Type String */
	protected $type = 'stub';

	/**
	 * Returns meta.
	 * @since 2.6.0
	 * @return string
	 */
	public function get_extra() {
		return $this->get_meta( 'extra' );
	}

	/**
	 * Set meta.
	 * @since 2.6.0
	 * @param string $extra
	 */
	public function set_extra( $extra ) {
		$this->add_meta_data( 'extra', $extra, true );
	}
}
