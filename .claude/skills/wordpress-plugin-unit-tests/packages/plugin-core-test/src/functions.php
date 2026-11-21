<?php

if ( ! function_exists( '_tests_dir' ) ) {

	function _tests_dir() {

		if ( ! $_tests_dir = getenv( 'WP_TESTS_DIR' ) ) {
			throw new Exception( "WP_TESTS_DIR not defined." );
		}

		return $_tests_dir;
	}
}

if ( ! function_exists( 'wpml_mock_file' ) ) {

	function wpml_mock_file() {

		return __DIR__ . '/WPML.php';
	}
}

if ( ! function_exists( '_fix_plugin_url' ) ) {

	function _fix_plugin_url( $url ) {

		if ( preg_match( '/\/' . PLUGIN_DIR . '(.*?)$/', $url, $match ) ) {

			return site_url( $match[1] );
		}

		return $url;
	}
}

if ( ! function_exists( 'cast_as_array' ) ) {

	function cast_as_array( $thing ) {

		return (array) $thing;
	}
}
