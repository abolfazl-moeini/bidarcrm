<?php

class SitePress {

	protected $current_language;

	public function get_current_language() {

		return $this->current_language ?? $this->wp_lang();
	}

	public function set_current_language( $lang_code ) {

		$this->current_language = $lang_code;
	}


	public function wp_lang() {

		$local = get_locale();
		$pos   = strpos( $local, '_' );

		return false === $pos ? $local : substr( $local, 0, $pos );
	}
}
