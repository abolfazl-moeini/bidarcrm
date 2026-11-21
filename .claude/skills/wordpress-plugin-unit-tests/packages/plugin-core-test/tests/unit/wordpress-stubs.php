<?php

declare( strict_types=1 );

if ( ! class_exists( 'WP_Hook' ) ) {
	class WP_Hook {
		public $callbacks = [];

		public function add_filter( $hook_name, $callback, $priority, $accepted_args ) {
			$idx = _wp_filter_build_unique_id( $hook_name, $callback, $priority );
			$this->callbacks[ $priority ][ $idx ] = [
				'function'      => $callback,
				'accepted_args' => $accepted_args,
			];
		}

		public function remove_filter( $hook_name, $callback, $priority ) {
			$idx = _wp_filter_build_unique_id( $hook_name, $callback, $priority );
			unset( $this->callbacks[ $priority ][ $idx ] );
			if ( empty( $this->callbacks[ $priority ] ) ) {
				unset( $this->callbacks[ $priority ] );
			}
		}

		public function apply_filters( $value, $args ) {
			if ( empty( $this->callbacks ) ) {
				return $value;
			}

			$sorted = $this->callbacks;
			ksort( $sorted );

			foreach ( $sorted as $priority => $callbacks ) {
				foreach ( $callbacks as $cb ) {
					$func     = $cb['function'];
					$accepted = $cb['accepted_args'];
					$pass     = array_slice( $args, 0, $accepted );
					$value    = call_user_func_array( $func, $pass );
					$args[0]  = $value;
				}
			}

			return $value;
		}

		public function has_filter( $hook_name = '', $callback = false ) {
			if ( false === $callback ) {
				return ! empty( $this->callbacks );
			}
			foreach ( $this->callbacks as $priority => $callbacks ) {
				$idx = _wp_filter_build_unique_id( $hook_name, $callback, $priority );
				if ( isset( $callbacks[ $idx ] ) ) {
					return $priority;
				}
			}
			return false;
		}
	}
}

if ( ! function_exists( '_wp_filter_build_unique_id' ) ) {
	function _wp_filter_build_unique_id( $hook_name, $callback, $priority ) {
		if ( is_string( $callback ) ) {
			return $callback;
		}
		if ( is_object( $callback ) ) {
			$callback = [ $callback, '' ];
		} else {
			$callback = (array) $callback;
		}
		if ( is_object( $callback[0] ) ) {
			return spl_object_hash( $callback[0] ) . $callback[1];
		}
		return $callback[0] . '::' . $callback[1];
	}
}

if ( ! function_exists( 'add_filter' ) ) {
	function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
		global $wp_filter;
		if ( ! isset( $wp_filter[ $hook ] ) ) {
			$wp_filter[ $hook ] = new WP_Hook();
		}
		$wp_filter[ $hook ]->add_filter( $hook, $callback, $priority, $accepted_args );
		return true;
	}
}

if ( ! function_exists( 'remove_filter' ) ) {
	function remove_filter( $hook, $callback, $priority = 10 ) {
		global $wp_filter;
		if ( isset( $wp_filter[ $hook ] ) ) {
			$wp_filter[ $hook ]->remove_filter( $hook, $callback, $priority );
		}
		return true;
	}
}

if ( ! function_exists( 'absint' ) ) {
	function absint( $maybeint ) {
		return abs( (int) $maybeint );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		$key = strtolower( (string) $key );
		return preg_replace( '/[^a-z0-9_\-]/', '', $key );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $option, $default = false ) {
		global $wp_options;
		if ( ! is_array( $wp_options ) ) {
			$wp_options = array();
		}
		return array_key_exists( $option, $wp_options ) ? $wp_options[ $option ] : $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $option, $value, $autoload = null ) {
		global $wp_options;
		if ( ! is_array( $wp_options ) ) {
			$wp_options = array();
		}
		$wp_options[ $option ] = $value;
		return true;
	}
}

if ( ! function_exists( 'has_filter' ) ) {
	function has_filter( $hook, $callback = false ) {
		global $wp_filter;
		if ( ! isset( $wp_filter[ $hook ] ) ) {
			return false;
		}
		return $wp_filter[ $hook ]->has_filter( $hook, $callback );
	}
}

if ( ! function_exists( 'has_action' ) ) {
	function has_action( $hook, $callback = false ) {
		return has_filter( $hook, $callback );
	}
}

if ( ! function_exists( 'current_time' ) ) {
	function current_time( $type, $gmt = 0 ) {
		switch ( $type ) {
			case 'mysql':
				return gmdate( 'Y-m-d H:i:s' );
			case 'timestamp':
				return time();
			default:
				return gmdate( $type );
		}
	}
}

if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $hook, $value, ...$args ) {
		global $wp_filter;
		array_unshift( $args, $value );
		if ( isset( $wp_filter[ $hook ] ) ) {
			return $wp_filter[ $hook ]->apply_filters( $value, $args );
		}
		return $value;
	}
}

if ( ! function_exists( 'add_action' ) ) {
	function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
		return add_filter( $hook, $callback, $priority, $accepted_args );
	}
}

if ( ! function_exists( 'do_action' ) ) {
	function do_action( $hook, ...$args ) {
		global $wp_filter;
		if ( isset( $wp_filter[ $hook ] ) ) {
			$wp_filter[ $hook ]->apply_filters( '', $args );
		}
	}
}

if ( ! function_exists( 'tests_add_filter' ) ) {
	function tests_add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
		return add_filter( $hook, $callback, $priority, $accepted_args );
	}
}

if ( ! function_exists( '_return_false' ) ) {
	function _return_false() {
		return false;
	}
}

if ( ! function_exists( '_return_true' ) ) {
	function _return_true() {
		return true;
	}
}

if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {
		public $errors = [];
		public $error_data = [];

		public function __construct( $code = '', $message = '', $data = '' ) {
			if ( ! empty( $code ) ) {
				$this->errors[ $code ][] = $message;
				if ( ! empty( $data ) ) {
					$this->error_data[ $code ] = $data;
				}
			}
		}

		public function get_error_code() {
			$codes = array_keys( $this->errors );
			return $codes[0] ?? '';
		}

		public function get_error_message( $code = '' ) {
			if ( empty( $code ) ) {
				$code = $this->get_error_code();
			}
			return $this->errors[ $code ][0] ?? '';
		}

		public function get_error_data( $code = '' ) {
			if ( empty( $code ) ) {
				$code = $this->get_error_code();
			}
			return $this->error_data[ $code ] ?? null;
		}
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ) {
		return $thing instanceof WP_Error;
	}
}

if ( ! function_exists( 'wp_remote_request' ) ) {
	function wp_remote_request( $url, $args = [] ) {
		$defaults = [
			'method'      => 'GET',
			'timeout'     => 5,
			'redirection' => 5,
			'httpversion' => '1.0',
			'user-agent'  => 'WordPress',
			'blocking'    => true,
			'headers'     => [],
			'cookies'     => [],
			'body'        => null,
			'sslverify'   => true,
		];
		$parsed_args = array_merge( $defaults, $args );

		$pre = apply_filters( 'pre_http_request', false, $parsed_args, $url );
		if ( false !== $pre ) {
			return $pre;
		}

		return new WP_Error( 'http_request_failed', 'Real network requests not mocked in unit test environment.' );
	}
}

if ( ! function_exists( 'wp_remote_get' ) ) {
	function wp_remote_get( $url, $args = [] ) {
		$args['method'] = 'GET';
		return wp_remote_request( $url, $args );
	}
}

if ( ! function_exists( 'wp_remote_post' ) ) {
	function wp_remote_post( $url, $args = [] ) {
		$args['method'] = 'POST';
		return wp_remote_request( $url, $args );
	}
}

if ( ! function_exists( 'wp_remote_retrieve_response_code' ) ) {
	function wp_remote_retrieve_response_code( $response ) {
		if ( is_wp_error( $response ) || ! isset( $response['response']['code'] ) ) {
			return '';
		}
		return (int) $response['response']['code'];
	}
}

if ( ! function_exists( 'wp_remote_retrieve_response_message' ) ) {
	function wp_remote_retrieve_response_message( $response ) {
		if ( is_wp_error( $response ) || ! isset( $response['response']['message'] ) ) {
			return '';
		}
		return $response['response']['message'];
	}
}

if ( ! function_exists( 'wp_remote_retrieve_body' ) ) {
	function wp_remote_retrieve_body( $response ) {
		if ( is_wp_error( $response ) || ! isset( $response['body'] ) ) {
			return '';
		}
		return (string) $response['body'];
	}
}

if ( ! function_exists( 'wp_remote_retrieve_headers' ) ) {
	function wp_remote_retrieve_headers( $response ) {
		if ( is_wp_error( $response ) || ! isset( $response['headers'] ) ) {
			return [];
		}
		return (array) $response['headers'];
	}
}

if ( ! function_exists( 'wp_remote_retrieve_header' ) ) {
	function wp_remote_retrieve_header( $response, $header ) {
		if ( is_wp_error( $response ) || ! isset( $response['headers'] ) ) {
			return '';
		}
		$headers = $response['headers'];
		if ( isset( $headers[ $header ] ) ) {
			return $headers[ $header ];
		}
		$lower = strtolower( $header );
		foreach ( $headers as $k => $v ) {
			if ( strtolower( (string) $k ) === $lower ) {
				return $v;
			}
		}
		return '';
	}
}

if ( ! function_exists( 'wp_remote_retrieve_cookies' ) ) {
	function wp_remote_retrieve_cookies( $response ) {
		if ( is_wp_error( $response ) || ! isset( $response['cookies'] ) ) {
			return [];
		}
		return (array) $response['cookies'];
	}
}

if ( ! function_exists( 'site_url' ) ) {
	function site_url( $path = '' ) {
		return 'https://example.com' . ( $path ? '/' . ltrim( $path, '/' ) : '' );
	}
}

if ( ! function_exists( 'get_site_url' ) ) {
	function get_site_url( $blog_id = null, $path = '', $scheme = null ) {
		return 'https://example.com' . ( $path ? '/' . ltrim( $path, '/' ) : '' );
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( $url, $component );
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, $options = 0, $depth = 512 ) {
		return json_encode( $data, $options, $depth );
	}
}

if ( ! function_exists( 'add_query_arg' ) ) {
	function add_query_arg( ...$args ) {
		if ( is_array( $args[0] ) ) {
			$qs  = $args[0];
			$url = $args[1] ?? '';
		} else {
			$qs  = [ $args[0] => $args[1] ];
			$url = $args[2] ?? '';
		}

		$parts = parse_url( $url );
		$existing = [];
		if ( ! empty( $parts['query'] ) ) {
			parse_str( $parts['query'], $existing );
		}
		$merged = array_merge( $existing, $qs );
		$query = http_build_query( $merged );

		$res = ( $parts['scheme'] ?? 'http' ) . '://' . ( $parts['host'] ?? '' );
		if ( ! empty( $parts['port'] ) ) {
			$res .= ':' . $parts['port'];
		}
		$res .= ( $parts['path'] ?? '' );
		if ( ! empty( $query ) ) {
			$res .= '?' . $query;
		}
		return $res;
	}
}

if ( ! function_exists( 'get_locale' ) ) {
	function get_locale() {
		return 'en_US';
	}
}

if ( ! class_exists( 'WP_UnitTestCase' ) ) {
	class WP_UnitTestCase extends \PHPUnit\Framework\TestCase {
		protected function setUp(): void {
			parent::setUp();
		}
		protected function tearDown(): void {
			parent::tearDown();
		}
	}
}
