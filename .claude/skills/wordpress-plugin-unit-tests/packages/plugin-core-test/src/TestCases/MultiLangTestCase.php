<?php

namespace WPDevTest\TestCases;

abstract class MultiLangTestCase extends TestCase {

	protected $objects = [];

	function setUp(): void {

		parent::setUp();

		$this->objects = [];

		add_filter( 'wpml_object_id', [ $this, 'wpml_object_id' ], 5, 4 );
	}

	protected function translate_post( $base_product, $translated_product, $language ) {

		$this->objects['product'][ $base_product ][ $language ] = $translated_product;
		$this->objects['product'][ $translated_product ]['en']  = $base_product;
	}

	/**
	 * Get the current language, or switch to $language when provided.
	 *
	 * @param string|null $language Language code to switch to, or null to read the current one.
	 *
	 * No return type declared on purpose: plugins subclass this helper, and adding
	 * one would break existing overrides that omit it.
	 *
	 * @return string Current language code.
	 */
	protected function current_lang( $language = null ) {

		if ( null === $language || '' === $language ) {

			return $this->get_current_language();
		}

		$this->set_current_language( $language );

		return $language;
	}


	/**
	 * @param int    $element_id
	 * @param string $element_type
	 * @param bool   $return_original_if_missing
	 * @param string $language_code
	 *
	 * @return int|null
	 */
	public function wpml_object_id( $element_id, $element_type, $return_original_if_missing, $language_code ) {

		if ( empty( $language_code ) ) {

			$language_code = $this->current_lang();
		}


		if ( isset( $this->objects[ $element_type ][ $element_id ][ $language_code ] ) ) {

			return $this->objects[ $element_type ][ $element_id ][ $language_code ];
		}

		return $return_original_if_missing ? $element_id : null;
	}
}
