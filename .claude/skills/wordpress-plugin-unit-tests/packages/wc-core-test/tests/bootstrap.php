<?php

declare( strict_types=1 );

require_once __DIR__ . '/../vendor/autoload.php';

// Global database mock
if ( ! isset( $GLOBALS['wpdb'] ) ) {
	class MockWPDB {
		public string $prefix = 'wp_';
		public int $insert_id = 1;
		public array $queries = array();
		public array $tables = array();

		public function query( string $query ) {
			$this->queries[] = $query;
			return true;
		}

		public function insert( string $table, array $data ) {
			$this->queries[] = "INSERT INTO {$table}";
			$this->tables[ $table ][] = $data;
			$this->insert_id++;
			return 1;
		}

		public function prepare( string $query, ...$args ) {
			return vsprintf( str_replace( '%d', '%d', str_replace( '%s', "'%s'", $query ) ), $args );
		}
	}

	$GLOBALS['wpdb'] = new MockWPDB();
}

// In-memory WordPress hooks system if not present
if ( ! function_exists( 'add_filter' ) ) {
	$GLOBALS['wp_filter'] = array();
	$GLOBALS['wp_actions'] = array();

	function add_filter( string $tag, $callback, int $priority = 10, int $accepted_args = 1 ): bool {
		$GLOBALS['wp_filter'][ $tag ][ $priority ][] = array(
			'function'      => $callback,
			'accepted_args' => $accepted_args,
		);
		return true;
	}

	function remove_filter( string $tag, $callback, int $priority = 10 ): bool {
		if ( isset( $GLOBALS['wp_filter'][ $tag ][ $priority ] ) ) {
			foreach ( $GLOBALS['wp_filter'][ $tag ][ $priority ] as $idx => $entry ) {
				if ( $entry['function'] === $callback ) {
					unset( $GLOBALS['wp_filter'][ $tag ][ $priority ][ $idx ] );
					return true;
				}
			}
		}
		return false;
	}

	function has_filter( string $tag, $callback = false ) {
		if ( ! isset( $GLOBALS['wp_filter'][ $tag ] ) || empty( $GLOBALS['wp_filter'][ $tag ] ) ) {
			return false;
		}
		if ( false === $callback ) {
			foreach ( array_keys( $GLOBALS['wp_filter'][ $tag ] ) as $priority ) {
				if ( ! empty( $GLOBALS['wp_filter'][ $tag ][ $priority ] ) ) {
					return $priority;
				}
			}
			return false;
		}
		foreach ( $GLOBALS['wp_filter'][ $tag ] as $priority => $callbacks ) {
			foreach ( $callbacks as $entry ) {
				if ( $entry['function'] === $callback ) {
					return $priority;
				}
			}
		}
		return false;
	}

	function apply_filters( string $tag, $value, ...$args ) {
		if ( ! isset( $GLOBALS['wp_filter'][ $tag ] ) ) {
			return $value;
		}
		ksort( $GLOBALS['wp_filter'][ $tag ] );
		foreach ( $GLOBALS['wp_filter'][ $tag ] as $priority => $callbacks ) {
			foreach ( $callbacks as $entry ) {
				$callback_args = array_merge( array( $value ), array_slice( $args, 0, $entry['accepted_args'] - 1 ) );
				$value = call_user_func_array( $entry['function'], $callback_args );
			}
		}
		return $value;
	}

	function add_action( string $tag, $callback, int $priority = 10, int $accepted_args = 1 ): bool {
		return add_filter( $tag, $callback, $priority, $accepted_args );
	}

	function remove_action( string $tag, $callback, int $priority = 10 ): bool {
		return remove_filter( $tag, $callback, $priority );
	}

	function has_action( string $tag, $callback = false ) {
		return has_filter( $tag, $callback );
	}

	function do_action( string $tag, ...$args ): void {
		$GLOBALS['wp_actions'][ $tag ] = ( $GLOBALS['wp_actions'][ $tag ] ?? 0 ) + 1;
		if ( ! isset( $GLOBALS['wp_filter'][ $tag ] ) ) {
			return;
		}
		ksort( $GLOBALS['wp_filter'][ $tag ] );
		foreach ( $GLOBALS['wp_filter'][ $tag ] as $priority => $callbacks ) {
			foreach ( $callbacks as $entry ) {
				$cb_args = array_slice( $args, 0, $entry['accepted_args'] );
				call_user_func_array( $entry['function'], $cb_args );
			}
		}
	}

	function did_action( string $tag ): int {
		return $GLOBALS['wp_actions'][ $tag ] ?? 0;
	}
}

// WordPress helpers
if ( ! function_exists( 'wp_rand' ) ) {
	function wp_rand( int $min = 0, int $max = 0 ): int {
		return mt_rand( $min, $max > 0 ? $max : PHP_INT_MAX );
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, int $options = 0, int $depth = 512 ) {
		return json_encode( $data, $options, $depth );
	}
}

if ( ! function_exists( 'current_time' ) ) {
	function current_time( string $type, int $gmt = 0 ): string {
		return gmdate( 'Y-m-d H:i:s' );
	}
}

if ( ! function_exists( 'update_option' ) ) {
	$GLOBALS['wp_options'] = array();

	function update_option( string $option, $value, $autoload = null ): bool {
		$GLOBALS['wp_options'][ $option ] = $value;
		return true;
	}

	function get_option( string $option, $default = false ) {
		return $GLOBALS['wp_options'][ $option ] ?? $default;
	}

	function delete_option( string $option ): bool {
		unset( $GLOBALS['wp_options'][ $option ] );
		return true;
	}
}

if ( ! function_exists( 'wp_create_nonce' ) ) {
	function wp_create_nonce( $action = -1 ): string {
		return 'mock_nonce_' . md5( (string) $action );
	}
}

if ( ! function_exists( 'wp_insert_post' ) ) {
	$GLOBALS['wp_posts'] = array();
	$GLOBALS['wp_postmeta'] = array();

	function wp_insert_post( array $postarr, bool $wp_error = false ) {
		static $id = 100;
		$id++;
		$GLOBALS['wp_posts'][ $id ] = $postarr;
		return $id;
	}

	function wp_delete_post( int $postid, bool $force_delete = false ) {
		unset( $GLOBALS['wp_posts'][ $postid ] );
		unset( $GLOBALS['wp_postmeta'][ $postid ] );
		return true;
	}

	function update_post_meta( int $post_id, string $meta_key, $meta_value, $prev_value = '' ) {
		$GLOBALS['wp_postmeta'][ $post_id ][ $meta_key ] = $meta_value;
		return true;
	}

	function get_post_meta( int $post_id, string $key = '', bool $single = false ) {
		if ( '' === $key ) {
			return $GLOBALS['wp_postmeta'][ $post_id ] ?? array();
		}
		$val = $GLOBALS['wp_postmeta'][ $post_id ][ $key ] ?? null;
		return $single ? $val : ( null !== $val ? array( $val ) : array() );
	}

	function delete_post_meta( int $post_id, string $meta_key, $meta_value = '' ) {
		unset( $GLOBALS['wp_postmeta'][ $post_id ][ $meta_key ] );
		return true;
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ): bool {
		return is_object( $thing ) && is_a( $thing, 'WP_Error' );
	}
}

if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {
		protected string $message;
		public function __construct( string $code = '', string $message = '' ) {
			$this->message = $message;
		}
		public function get_error_message(): string {
			return $this->message;
		}
	}
}

// REST stubs
if ( ! class_exists( 'WP_REST_Request' ) ) {
	class WP_REST_Request {
		public string $method;
		public string $route;
		public array $headers = array();
		public array $params = array();
		public string $body = '';

		public function __construct( string $method = 'GET', string $route = '' ) {
			$this->method = $method;
			$this->route  = $route;
		}

		public function set_header( string $key, string $value ): void {
			$this->headers[ strtolower( $key ) ] = $value;
		}

		public function get_header( string $key ): ?string {
			return $this->headers[ strtolower( $key ) ] ?? null;
		}

		public function set_query_params( array $params ): void {
			$this->params = $params;
		}

		public function set_body( string $body ): void {
			$this->body = $body;
		}
	}
}

if ( ! class_exists( 'WP_REST_Response' ) ) {
	class WP_REST_Response {
		public $data;
		public int $status;
		public array $headers = array();

		public function __construct( $data = null, int $status = 200, array $headers = array() ) {
			$this->data    = $data;
			$this->status  = $status;
			$this->headers = $headers;
		}

		public function get_status(): int {
			return $this->status;
		}

		public function get_data() {
			return $this->data;
		}
	}
}

if ( ! function_exists( 'rest_do_request' ) ) {
	function rest_do_request( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( array( 'success' => true, 'route' => $request->route ), 200 );
	}
}

// WooCommerce Core classes and functions
if ( ! class_exists( 'WC_Order' ) ) {
	class WC_Order {
		public int $id = 0;
		public float $total = 0.0;
		public string $status = 'pending';
		public array $items = array();
		public array $meta = array();
		public int $customer_id = 0;
		public ?string $payment_method = null;
		public string $payment_method_title = '';
		public float $shipping_total = 0.0;
		public array $billing_address = array();
		public array $shipping_address = array();
		public ?int $date_paid = null;

		public function __construct( $id = 0 ) {
			static $counter = 1000;
			$this->id = is_numeric( $id ) && $id > 0 ? (int) $id : ++$counter;
		}

		public function get_id(): int {
			return $this->id;
		}

		public function get_total(): float {
			return $this->total;
		}

		public function get_status(): string {
			return $this->status;
		}

		public function set_status( string $status ): void {
			$this->status = str_replace( 'wc-', '', $status );
		}

		public function update_status( string $status, string $note = '' ): void {
			$this->set_status( $status );
		}

		public function get_items( $types = 'line_item' ): array {
			return $this->items;
		}

		public function add_item( $item ): void {
			$this->items[] = $item;
		}

		public function get_meta( string $key ) {
			return $this->meta[ $key ] ?? null;
		}

		public function update_meta_data( string $key, $value ): void {
			$this->meta[ $key ] = $value;
		}

		public function set_address( array $address, string $type = 'billing' ): void {
			if ( 'billing' === $type ) {
				$this->billing_address = $address;
			} else {
				$this->shipping_address = $address;
			}
		}

		public function set_shipping_total( $total ): void {
			$this->shipping_total = (float) $total;
		}

		public function set_payment_method( string $method ): void {
			$this->payment_method = $method;
		}

		public function set_payment_method_title( string $title ): void {
			$this->payment_method_title = $title;
		}

		public function set_date_paid( int $timestamp ): void {
			$this->date_paid = $timestamp;
		}

		public function calculate_totals( bool $and_taxes = true ): void {
			$sum = 0.0;
			foreach ( $this->items as $item ) {
				if ( is_object( $item ) && method_exists( $item, 'get_total' ) ) {
					$sum += (float) $item->get_total();
				}
			}
			$sum += $this->shipping_total;
			$this->total = $sum;
		}

		public function payment_complete( string $txn_id = '' ): void {
			$this->set_status( 'processing' );
			$this->date_paid = time();
			$this->update_meta_data( '_transaction_id', $txn_id );
			if ( function_exists( 'do_action' ) ) {
				do_action( 'woocommerce_payment_complete', $this->id );
				do_action( 'woocommerce_order_status_pending_to_processing_notification', $this->id );
			}
		}

		public function get_date_paid(): ?int {
			return $this->date_paid;
		}

		public function is_paid(): bool {
			return in_array( $this->status, array( 'processing', 'completed' ), true ) || null !== $this->date_paid;
		}

		public function get_customer_id(): int {
			return $this->customer_id;
		}

		public function get_payment_method(): ?string {
			return $this->payment_method;
		}

		public function save(): int {
			return $this->id;
		}

		public function delete( bool $force = true ): bool {
			return true;
		}
	}
}

if ( ! class_exists( 'WC_Order_Item' ) ) {
	class WC_Order_Item {
		public int $id = 0;
		public array $props = array();
		public function set_props( array $props ): void {
			$this->props = array_merge( $this->props, $props );
		}
		public function save(): int {
			static $item_id = 500;
			$this->id = ++$item_id;
			return $this->id;
		}
		public function get_total(): float {
			return (float) ( $this->props['total'] ?? 0.0 );
		}
		public function set_order_id( int $id ): void {
			$this->props['order_id'] = $id;
		}
		public function set_name( string $name ): void {
			$this->props['name'] = $name;
		}
		public function set_total( $total ): void {
			$this->props['total'] = (string) $total;
		}
	}

	class WC_Order_Item_Product extends WC_Order_Item {}
	class WC_Order_Item_Shipping extends WC_Order_Item {}
	class WC_Order_Item_Fee extends WC_Order_Item {}
	class WC_Order_Item_Coupon extends WC_Order_Item {
		public function set_code( string $code ): void {
			$this->props['code'] = $code;
		}
		public function set_discount( string $discount ): void {
			$this->props['discount'] = $discount;
		}
	}
	class WC_Order_Refund extends WC_Order {
		public float $amount = 0.0;
		public string $reason = '';
	}
}

if ( ! class_exists( 'WC_Product' ) ) {
	class WC_Product {
		public int $id = 0;
		public array $props = array();
		public array $attributes = array();
		public array $children = array();

		public function __construct( $id = 0 ) {
			static $prod_id = 2000;
			$this->id = is_numeric( $id ) && $id > 0 ? (int) $id : ++$prod_id;
		}

		public function get_id(): int {
			return $this->id;
		}

		public function set_props( array $props ): void {
			$this->props = array_merge( $this->props, $props );
		}

		public function get_price(): float {
			return (float) ( $this->props['price'] ?? 20.0 );
		}

		public function get_name(): string {
			return $this->props['name'] ?? 'Product';
		}

		public function set_attributes( array $attributes ): void {
			$this->attributes = $attributes;
		}

		public function set_children( array $children ): void {
			$this->children = $children;
		}

		public function save(): int {
			$GLOBALS['wc_products'][ $this->id ] = $this;
			return $this->id;
		}

		public function delete( bool $force = true ): bool {
			return true;
		}
	}

	class WC_Product_Simple extends WC_Product {}
	class WC_Product_External extends WC_Product {}
	class WC_Product_Grouped extends WC_Product {}
	class WC_Product_Variable extends WC_Product {}
	class WC_Product_Variation extends WC_Product {}
	class WC_Product_Attribute {
		public array $data = array();
		public function set_name( string $name ) { $this->data['name'] = $name; }
		public function set_options( array $options ) { $this->data['options'] = $options; }
		public function set_position( int $pos ) { $this->data['position'] = $pos; }
		public function set_visible( bool $vis ) { $this->data['visible'] = $vis; }
		public function set_variation( bool $is_var ) { $this->data['variation'] = $is_var; }
	}
}

if ( ! class_exists( 'WC_Coupon' ) ) {
	class WC_Coupon {
		public int $id = 0;
		public string $code = '';
		public float $amount = 0.0;
		public string $discount_type = 'fixed_cart';
		public bool $free_shipping = false;
		public bool $individual_use = false;
		public bool $exclude_sale_items = false;
		public float $minimum_amount = 0.0;
		public float $maximum_amount = 0.0;
		public array $product_ids = array();
		public array $excluded_product_ids = array();
		public array $product_categories = array();
		public array $excluded_product_categories = array();
		public int $usage_limit = 0;
		public int $usage_limit_per_user = 0;
		public ?string $date_expires = null;
		public array $meta = array();

		public function __construct( $code = '' ) {
			static $coup_id = 3000;
			$this->id   = ++$coup_id;
			$this->code = is_string( $code ) ? $code : '';
		}

		public function get_id(): int { return $this->id; }
		public function get_code(): string { return $this->code; }
		public function get_amount(): float { return $this->amount; }
		public function get_discount_type(): string { return $this->discount_type; }
		public function set_code( string $c ): void { $this->code = $c; }
		public function set_amount( $a ): void { $this->amount = (float) $a; }
		public function set_discount_type( string $t ): void { $this->discount_type = $t; }
		public function set_free_shipping( bool $f ): void { $this->free_shipping = $f; }
		public function set_individual_use( bool $i ): void { $this->individual_use = $i; }
		public function set_exclude_sale_items( bool $e ): void { $this->exclude_sale_items = $e; }
		public function set_minimum_amount( $m ): void { $this->minimum_amount = (float) $m; }
		public function set_maximum_amount( $m ): void { $this->maximum_amount = (float) $m; }
		public function set_product_ids( array $ids ): void { $this->product_ids = $ids; }
		public function set_excluded_product_ids( array $ids ): void { $this->excluded_product_ids = $ids; }
		public function set_product_categories( array $ids ): void { $this->product_categories = $ids; }
		public function set_excluded_product_categories( array $ids ): void { $this->excluded_product_categories = $ids; }
		public function set_usage_limit( int $l ): void { $this->usage_limit = $l; }
		public function set_usage_limit_per_user( int $l ): void { $this->usage_limit_per_user = $l; }
		public function set_date_expires( $d ): void { $this->date_expires = (string) $d; }
		public function update_meta_data( string $k, $v ): void { $this->meta[ $k ] = $v; }
		public function save(): int { return $this->id; }
		public function delete( bool $force = true ): bool { return true; }
	}
}

if ( ! class_exists( 'WC_Customer' ) ) {
	class WC_Customer {
		public int $id = 0;
		public string $username = '';
		public string $email = '';
		public string $password = '';
		public string $first_name = '';
		public string $last_name = '';
		public array $billing = array();
		public array $shipping = array();

		public function __construct( $id = 0, bool $is_session = false ) {
			static $cust_id = 4000;
			$this->id = is_numeric( $id ) && $id > 0 ? (int) $id : ++$cust_id;
		}

		public function get_id(): int { return $this->id; }
		public function set_username( string $u ) { $this->username = $u; }
		public function set_email( string $e ) { $this->email = $e; }
		public function set_password( string $p ) { $this->password = $p; }
		public function set_first_name( string $n ) { $this->first_name = $n; }
		public function set_last_name( string $n ) { $this->last_name = $n; }
		public function set_billing_first_name( string $v ) { $this->billing['first_name'] = $v; }
		public function set_billing_last_name( string $v ) { $this->billing['last_name'] = $v; }
		public function set_billing_address_1( string $v ) { $this->billing['address_1'] = $v; }
		public function set_billing_address_2( string $v ) { $this->billing['address_2'] = $v; }
		public function set_billing_city( string $v ) { $this->billing['city'] = $v; }
		public function set_billing_state( string $v ) { $this->billing['state'] = $v; }
		public function set_billing_postcode( string $v ) { $this->billing['postcode'] = $v; }
		public function set_billing_country( string $v ) { $this->billing['country'] = $v; }
		public function set_billing_email( string $v ) { $this->billing['email'] = $v; }
		public function set_billing_phone( string $v ) { $this->billing['phone'] = $v; }
		public function set_billing_address( string $v ) { $this->billing['address_1'] = $v; }
		public function set_shipping_first_name( string $v ) { $this->shipping['first_name'] = $v; }
		public function set_shipping_last_name( string $v ) { $this->shipping['last_name'] = $v; }
		public function set_shipping_address_1( string $v ) { $this->shipping['address_1'] = $v; }
		public function set_shipping_address_2( string $v ) { $this->shipping['address_2'] = $v; }
		public function set_shipping_city( string $v ) { $this->shipping['city'] = $v; }
		public function set_shipping_state( string $v ) { $this->shipping['state'] = $v; }
		public function set_shipping_postcode( string $v ) { $this->shipping['postcode'] = $v; }
		public function set_shipping_country( string $v ) { $this->shipping['country'] = $v; }
		public function set_shipping_address( string $v ) { $this->shipping['address_1'] = $v; }
		public function get_billing_first_name() { return $this->billing['first_name'] ?? 'John'; }
		public function get_billing_last_name() { return $this->billing['last_name'] ?? 'Doe'; }
		public function get_billing_email() { return $this->billing['email'] ?? 'john@example.test'; }
		public function get_billing_phone() { return $this->billing['phone'] ?? '555-0199'; }
		public function get_billing_address_1() { return $this->billing['address_1'] ?? '123 Main St'; }
		public function get_billing_city() { return $this->billing['city'] ?? 'City'; }
		public function get_billing_state() { return $this->billing['state'] ?? 'CA'; }
		public function get_billing_postcode() { return $this->billing['postcode'] ?? '90210'; }
		public function get_billing_country() { return $this->billing['country'] ?? 'US'; }
		public function save(): int { return $this->id; }
	}
}

if ( ! class_exists( 'WC_Shipping_Zone' ) ) {
	class WC_Shipping_Zone {
		public int $id = 0;
		public string $name = '';
		public int $order = 0;
		public array $locations = array();
		public array $methods = array();

		public function __construct( $id = 0 ) {
			static $zone_id = 6000;
			$this->id = is_numeric( $id ) && $id > 0 ? (int) $id : ++$zone_id;
		}
		public function get_id(): int { return $this->id; }
		public function set_zone_name( string $name ): void { $this->name = $name; }
		public function set_zone_order( int $order ): void { $this->order = $order; }
		public function add_location( string $code, string $type ): void {
			$this->locations[] = array( 'code' => $code, 'type' => $type );
		}
		public function add_shipping_method( string $method_id ): void {
			$this->methods[] = $method_id;
		}
		public function save(): int { return $this->id; }
	}
}

if ( ! class_exists( 'WC_Cache_Helper' ) ) {
	class WC_Cache_Helper {
		public static function get_transient_version( string $group, bool $refresh = false ): string {
			return '1.0';
		}
		public static function invalidate_cache_group( string $group ): void {}
	}
}

// WooCommerce functions
if ( ! function_exists( 'wc_get_order' ) ) {
	$GLOBALS['wc_orders'] = array();

	function wc_get_order( $id ) {
		if ( is_a( $id, 'WC_Order' ) ) {
			return $id;
		}
		return $GLOBALS['wc_orders'][ (int) $id ] ?? new WC_Order( (int) $id );
	}

	function wc_create_order( array $args = array() ): WC_Order {
		$order = new WC_Order();
		if ( isset( $args['status'] ) ) {
			$order->set_status( $args['status'] );
		}
		if ( isset( $args['customer_id'] ) ) {
			$order->customer_id = (int) $args['customer_id'];
		}
		$GLOBALS['wc_orders'][ $order->get_id() ] = $order;
		return $order;
	}

	function wc_create_refund( array $args ): WC_Order_Refund {
		$refund = new WC_Order_Refund();
		$refund->amount = (float) ( $args['amount'] ?? 0.0 );
		$refund->reason = (string) ( $args['reason'] ?? '' );
		return $refund;
	}

	$GLOBALS['wc_products'] = array();

	function wc_get_product( $id ) {
		if ( is_a( $id, 'WC_Product' ) ) {
			return $id;
		}
		return $GLOBALS['wc_products'][ (int) $id ] ?? new WC_Product( (int) $id );
	}
}

if ( ! function_exists( 'wc_add_notice' ) ) {
	$GLOBALS['wc_notices'] = array();

	function wc_add_notice( string $message, string $notice_type = 'success', array $data = array() ): void {
		$GLOBALS['wc_notices'][ $notice_type ][] = $message;
	}

	function wc_clear_notices(): void {
		$GLOBALS['wc_notices'] = array();
	}

	function wc_get_notices( ?string $notice_type = null ): array {
		if ( null !== $notice_type ) {
			return $GLOBALS['wc_notices'][ $notice_type ] ?? array();
		}
		return $GLOBALS['wc_notices'];
	}
}

// WooCommerce session, cart, and storefront context
if ( ! class_exists( 'WC_Mock_Session_Handler' ) ) {
	class WC_Mock_Session_Handler {
		public array $data = array();
		public function set( $key, $value ) { $this->data[ $key ] = $value; }
		public function get( $key ) { return $this->data[ $key ] ?? null; }
		public function cleanup_session() { $this->data = array(); }
		public function destroy_session() { $this->data = array(); }
		public function get_customer_id() { return 1; }
	}
}

if ( ! class_exists( 'WC_Cart' ) ) {
	class WC_Cart {
		public array $items = array();
		public array $coupons = array();
		public array $fees = array();
		public float $total = 0.0;
		public float $subtotal = 0.0;

		public function add_to_cart( $product_id, $qty = 1 ) {
			$this->items[] = array( 'product_id' => $product_id, 'qty' => $qty );
			$this->subtotal += 50.0 * $qty;
		}
		public function apply_coupon( $code ) { $this->coupons[] = $code; }
		public function add_fee( $name, $amount, $taxable = false ) {
			$this->fees[] = array( 'name' => $name, 'amount' => $amount, 'taxable' => $taxable );
		}
		public function calculate_totals() { $this->total = $this->subtotal; }
		public function get_total( $context = 'view' ) { return $this->total; }
		public function get_subtotal() { return $this->subtotal; }
		public function get_total_tax() { return 0.0; }
		public function get_cart_contents_count() {
			$count = 0;
			foreach ( $this->items as $item ) { $count += $item['qty']; }
			return $count;
		}
		public function empty_cart() {
			$this->items = array();
			$this->coupons = array();
			$this->fees = array();
			$this->total = 0.0;
			$this->subtotal = 0.0;
		}
	}
}

if ( ! class_exists( 'WC_Checkout' ) ) {
	class WC_Checkout {
		public static $instance = null;
		public static function instance() {
			if ( null === self::$instance ) {
				self::$instance = new self();
			}
			return self::$instance;
		}
		public function process_checkout() {
			$order = wc_create_order();
			$order->set_status( 'processing' );
			do_action( 'woocommerce_checkout_order_processed', $order->get_id(), array(), $order );
			return array( 'result' => 'success', 'redirect' => '' );
		}
	}
}

if ( ! class_exists( 'WC_Payment_Tokens' ) ) {
	class WC_Payment_Tokens {
		public static $tokens = array();
		public static function get( $token_id ) {
			return self::$tokens[ $token_id ] ?? null;
		}
	}

	class WC_Payment_Token {
		public int $id = 0;
		public string $token = '';
		public function __construct() {
			static $t_id = 7000;
			$this->id = ++$t_id;
		}
		public function get_id(): int { return $this->id; }
		public function set_token( string $t ) { $this->token = $t; }
		public function save() {
			WC_Payment_Tokens::$tokens[ $this->id ] = $this;
			return $this->id;
		}
		public function delete( bool $force = true ) {
			unset( WC_Payment_Tokens::$tokens[ $this->id ] );
			return true;
		}
	}

	class WC_Payment_Token_CC extends WC_Payment_Token {
		public string $last4 = '';
		public string $expiry_month = '';
		public string $expiry_year = '';
		public string $card_type = '';
		public int $user_id = 0;
		public function set_last4( string $l ) { $this->last4 = $l; }
		public function set_expiry_month( string $m ) { $this->expiry_month = $m; }
		public function set_expiry_year( string $y ) { $this->expiry_year = $y; }
		public function set_card_type( string $t ) { $this->card_type = $t; }
		public function set_user_id( $u ) { $this->user_id = (int) $u; }
	}

	class WC_Payment_Token_ECheck extends WC_Payment_Token {
		public string $last4 = '';
		public function set_last4( string $l ) { $this->last4 = $l; }
	}
}

if ( ! class_exists( 'ActionScheduler_QueueRunner' ) ) {
	class ActionScheduler_QueueRunner {
		public static $instance = null;
		public static function instance() {
			if ( null === self::$instance ) {
				self::$instance = new self();
			}
			return self::$instance;
		}
		public function run(): int {
			return 3;
		}
	}
}

if ( ! function_exists( 'as_has_scheduled_action' ) ) {
	$GLOBALS['as_scheduled_actions'] = array();

	function as_has_scheduled_action( string $hook, ?array $args = null ): bool {
		return isset( $GLOBALS['as_scheduled_actions'][ $hook ] );
	}
}

// WC() main function
if ( ! function_exists( 'WC' ) ) {
	class WooCommerceMockInstance {
		public $cart;
		public $session;
		public $customer;
		public $payment_gateways;
		public $shipping;

		public function __construct() {
			$this->cart             = new WC_Cart();
			$this->session          = new WC_Mock_Session_Handler();
			$this->customer         = new WC_Customer( 0, true );
			$this->payment_gateways = new class {
				public function init() {}
			};
			$this->shipping         = new class {
				public function load_shipping_methods() {}
				public function unregister_shipping_methods() {}
			};
		}

		public function checkout() {
			return WC_Checkout::instance();
		}

		public function shipping() {
			return $this->shipping;
		}
	}

	function WC(): WooCommerceMockInstance {
		static $instance = null;
		if ( null === $instance ) {
			$instance = new WooCommerceMockInstance();
		}
		return $instance;
	}
}
