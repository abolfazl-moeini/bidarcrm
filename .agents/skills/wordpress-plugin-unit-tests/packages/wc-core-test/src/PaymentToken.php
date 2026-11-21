<?php

namespace WPDevTest\Woocommerce;

use WC_Payment_Token_CC,WC_Payment_Token_ECheck,WC_Payment_Token_Stub;

/**
 * Class WC_Helper_Payment_Token
 *
 * This helper class should ONLY be used for unit tests!
 *
 * @package WPDevTest\Woocommerce
 */
class PaymentToken {

	/**
	 * Create a new credit card payment token
	 *
	 * @since 2.6
	 * @return WC_Payment_Token_CC object
	 */
	public static function create_cc_token( $user_id = '' ) {
		$token = new WC_Payment_Token_CC();
		$token->set_last4( '1234' );
		$token->set_expiry_month( '12' );
		$token->set_expiry_year( gmdate( 'Y', strtotime( '+2 years' ) ) );
		$token->set_card_type( 'visa' );
		$token->set_token( (string) wp_rand( 1000000000, 9999999999 ) );
		if ( ! empty( $user_id ) ) {
			$token->set_user_id( $user_id );
		}
		$token->save();

		if ( class_exists( '\WPDevTest\Woocommerce\State\ResourceRegistry' ) ) {
			\WPDevTest\Woocommerce\State\ResourceRegistry::register( 'payment_token', $token->get_id() );
		}

		return $token;
	}

	/**
	 * Create a new eCheck payment token
	 *
	 * @since 2.6
	 * @return WC_Payment_Token_ECheck object
	 */
	public static function create_eCheck_token() {
		$token = new WC_Payment_Token_ECheck();
		$token->set_last4( '1234' );
		$token->set_token( (string) wp_rand( 1000000000, 9999999999 ) );
		$token->save();

		if ( class_exists( '\WPDevTest\Woocommerce\State\ResourceRegistry' ) ) {
			\WPDevTest\Woocommerce\State\ResourceRegistry::register( 'payment_token', $token->get_id() );
		}

		return $token;
	}

	/**
	 * Create a new 'stub' payment token
	 *
	 * @since 2.6
	 * @param  string $extra A string to insert and get to test the metadata functionality of a token
	 * @return WC_Payment_Token_Stub object
	 */
	public static function create_stub_token( $extra ) {
		$token = new TokenStub();
		$token->set_extra( $extra );
		$token->set_token( (string) wp_rand( 1000000000, 9999999999 ) );
		$token->save();

		if ( class_exists( '\WPDevTest\Woocommerce\State\ResourceRegistry' ) ) {
			\WPDevTest\Woocommerce\State\ResourceRegistry::register( 'payment_token', $token->get_id() );
		}

		return $token;
	}

	/**
	 * Delete a payment token.
	 *
	 * @param int $token_id
	 * @return bool
	 */
	public static function delete_token( $token_id ) {
		$token = \WC_Payment_Tokens::get( $token_id );
		if ( $token ) {
			return $token->delete( true );
		}
		return false;
	}
}
