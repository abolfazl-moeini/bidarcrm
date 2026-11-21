<?php
/**
 * Plugin Name:       Didar CRM
 * Plugin URI:        https://github.com/abolfazl-moeini/didar
 * Description:       Open Source Didar CRM clone for WordPress — built on WPDev platform architecture.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Didar Open Source Team
 * Author URI:        https://github.com/abolfazl-moeini/didar
 * License:           Unlicense
 * License URI:       https://unlicense.org/
 * Text Domain:       didar-crm
 * Domain Path:       /languages
 *
 * @package didar-crm
 */

/*
 * -----------------------------------------------------------------------------
 * Bootstrap guard
 * -----------------------------------------------------------------------------
 * WordPress will only load this file once. The ABSPATH guard prevents the
 * plugin file from being opened directly in a browser.
 */
defined( 'ABSPATH' ) || exit;

/*
 * -----------------------------------------------------------------------------
 * PHP version gate (runtime — Composer platform-check is disabled)
 * -----------------------------------------------------------------------------
 */
if ( ! defined( 'DIDAR_CRM_PHP_MIN' ) ) {
	define( 'DIDAR_CRM_PHP_MIN', '7.4' );
}

if ( version_compare( PHP_VERSION, DIDAR_CRM_PHP_MIN, '<' ) ) {
	if ( ! function_exists( 'didar_crm_php_version_notice' ) ) {
		/**
		 * @return void
		 */
		function didar_crm_php_version_notice() {
			if ( function_exists( 'current_user_can' ) && ! current_user_can( 'activate_plugins' ) ) {
				return;
			}
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html(
					sprintf(
						/* translators: 1: plugin name, 2: required PHP version, 3: running PHP version */
						__( '%1$s requires PHP %2$s or higher. This site is running PHP %3$s.', 'didar-crm' ),
						'Didar CRM',
						DIDAR_CRM_PHP_MIN,
						PHP_VERSION
					)
				)
			);
		}
	}
	add_action( 'admin_notices', 'didar_crm_php_version_notice' );

	register_activation_hook(
		__FILE__,
		static function () {
			if ( function_exists( 'deactivate_plugins' ) ) {
				deactivate_plugins( plugin_basename( __FILE__ ) );
			}
			wp_die(
				esc_html(
					sprintf(
						/* translators: 1: plugin name, 2: required PHP version, 3: running PHP version */
						__( '%1$s requires PHP %2$s or higher. This site is running PHP %3$s.', 'didar-crm' ),
						'Didar CRM',
						DIDAR_CRM_PHP_MIN,
						PHP_VERSION
					)
				),
				esc_html__( 'Plugin activation error', 'didar-crm' ),
				array( 'back_link' => true )
			);
		}
	);

	return;
}

// Prevent double bootstrap when co-installed copies coexist.
if ( defined( 'DIDAR_CRM_LOADED' ) ) {
	return;
}
define( 'DIDAR_CRM_LOADED', true );

/*
 * -----------------------------------------------------------------------------
 * Plugin constants
 * -----------------------------------------------------------------------------
 */
if ( ! defined( 'DIDAR_CRM_VERSION' ) ) {
	define( 'DIDAR_CRM_VERSION', '0.1.0' );
}
if ( ! defined( 'DIDAR_CRM_PLUGIN_FILE' ) ) {
	define( 'DIDAR_CRM_PLUGIN_FILE', __FILE__ );
}
if ( ! defined( 'DIDAR_CRM_PLUGIN_DIR' ) ) {
	define( 'DIDAR_CRM_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
}

/**
 * Define shared brand top-level menu slug before framework or vendor autoload.
 */
if ( ! defined( 'WPDEV_BRAND_MENU_SLUG' ) ) {
	define( 'WPDEV_BRAND_MENU_SLUG', 'didar-crm' );
}

/*
 * -----------------------------------------------------------------------------
 * Composer autoloaders (scoped vendor FIRST)
 * -----------------------------------------------------------------------------
 */
$scoped_autoload = __DIR__ . '/vendor-prefixed/autoload.php';
$vendor_autoload = __DIR__ . '/vendor/autoload.php';

if ( is_readable( $scoped_autoload ) ) {
	require_once $scoped_autoload;
}

if ( is_readable( $vendor_autoload ) ) {
	require_once $vendor_autoload;
} elseif ( ! is_readable( $scoped_autoload ) ) {
	add_action( 'admin_notices', function (): void {
		echo '<div class="error"><p>' . esc_html__( 'Didar CRM requires Composer. Run `composer install` in the plugin directory.', 'didar-crm' ) . '</p></div>';
	} );
	return;
}

/*
 * -----------------------------------------------------------------------------
 * Lifecycle: activation / deactivation / uninstall
 * -----------------------------------------------------------------------------
 */
register_activation_hook(
	__FILE__,
	[ 'didar_crm_on_activate', 'handle' ]
);
register_deactivation_hook(
	__FILE__,
	[ 'didar_crm_on_deactivate', 'handle' ]
);
register_uninstall_hook(
	__FILE__,
	'didar_crm_on_uninstall'
);

if ( ! class_exists( 'didar_crm_on_activate' ) ) {
	class didar_crm_on_activate {
		public static function handle(): void {
			// Activation work goes here. Keep idempotent.
		}
	}
}

if ( ! class_exists( 'didar_crm_on_deactivate' ) ) {
	class didar_crm_on_deactivate {
		public static function handle(): void {
			// Deactivation work goes here. Keep idempotent.
		}
	}
}

if ( ! function_exists( 'didar_crm_on_uninstall' ) ) {
	function didar_crm_on_uninstall(): void {
		// Uninstall work goes here.
	}
}

/*
 * -----------------------------------------------------------------------------
 * Translation loading
 * -----------------------------------------------------------------------------
 */
add_action( 'init', 'didar_crm_load_textdomain', 1 );
if ( ! function_exists( 'didar_crm_load_textdomain' ) ) {
	function didar_crm_load_textdomain(): void {
		load_plugin_textdomain(
			'didar-crm',
			false,
			dirname( plugin_basename( __FILE__ ) ) . '/languages'
		);
	}
}

/*
 * -----------------------------------------------------------------------------
 * Register feature modules
 * -----------------------------------------------------------------------------
 */
if ( ! function_exists( 'didar_crm_register_modules' ) ) {
	function didar_crm_register_modules(): void {
		if ( ! class_exists( \WPDev\Core\Plugin::class ) ) {
			return;
		}
		$loader = \WPDev\Core\Plugin::loader();
		if ( class_exists( \DidarCRM\Modules\Deals\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\Deals\Module() );
		}
		if ( class_exists( \DidarCRM\Modules\Contacts\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\Contacts\Module() );
		}
		if ( class_exists( \DidarCRM\Modules\Activities\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\Activities\Module() );
		}
		if ( class_exists( \DidarCRM\Modules\Analytics\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\Analytics\Module() );
		}
		if ( class_exists( \DidarCRM\Modules\Sms\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\Sms\Module() );
		}
		if ( class_exists( \DidarCRM\Modules\Auth\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\Auth\Module() );
		}
		if ( class_exists( \DidarCRM\Modules\LeadCapture\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\LeadCapture\Module() );
		}
		if ( class_exists( \DidarCRM\Modules\Workflows\Module::class ) ) {
			$loader->register( new \DidarCRM\Modules\Workflows\Module() );
		}
	}
}
add_action( 'plugins_loaded', 'didar_crm_register_modules', 5 );

/*
 * -----------------------------------------------------------------------------
 * Wire WPDev\Core\Plugin
 * -----------------------------------------------------------------------------
 */
add_action(
	'plugins_loaded',
	static function (): void {
		if ( ! class_exists( \WPDev\Core\Plugin::class ) ) {
			return;
		}
		if ( defined( 'DIDAR_CRM_PLUGIN_DIR' ) ) {
			if ( method_exists( \WPDev\Core\Plugin::class, 'set_plugin_dir' ) ) {
				\WPDev\Core\Plugin::set_plugin_dir( DIDAR_CRM_PLUGIN_DIR );
			}
			if (
				class_exists( \WPDev\Support\Assets::class ) &&
				defined( 'DIDAR_CRM_PLUGIN_FILE' )
			) {
				if ( method_exists( \WPDev\Support\Assets::class, 'set_plugin_dir' ) ) {
					\WPDev\Support\Assets::set_plugin_dir(
						DIDAR_CRM_PLUGIN_DIR,
						plugins_url( '', DIDAR_CRM_PLUGIN_FILE )
					);
				}
				// Shared vendors (handle: preact) — first registrant wins across plugins.
				add_action(
					'init',
					static function (): void {
						if ( method_exists( \WPDev\Support\Assets::class, 'register_vendor_scripts' ) ) {
							\WPDev\Support\Assets::register_vendor_scripts();
						}
					},
					1,
					0
				);
			}
		}
		$config_file = is_readable( DIDAR_CRM_PLUGIN_DIR . 'wpdev.json' )
			? DIDAR_CRM_PLUGIN_DIR . 'wpdev.json'
			: null;
		if ( method_exists( \WPDev\Core\Plugin::class, 'boot' ) ) {
			\WPDev\Core\Plugin::boot( $config_file );
		}
	},
	10,
	0
);

// Safety net when plugins_loaded already fired (CLI / unit tests).
if (
	class_exists( \WPDev\Core\Plugin::class )
	&& did_action( 'plugins_loaded' )
	&& ! ( defined( 'WP_SANDBOX_SCRAPING' ) && WP_SANDBOX_SCRAPING )
) {
	if ( defined( 'DIDAR_CRM_PLUGIN_DIR' ) ) {
		if ( method_exists( \WPDev\Core\Plugin::class, 'set_plugin_dir' ) ) {
			\WPDev\Core\Plugin::set_plugin_dir( DIDAR_CRM_PLUGIN_DIR );
		}
		if (
			class_exists( \WPDev\Support\Assets::class ) &&
			defined( 'DIDAR_CRM_PLUGIN_FILE' )
		) {
			if ( method_exists( \WPDev\Support\Assets::class, 'set_plugin_dir' ) ) {
				\WPDev\Support\Assets::set_plugin_dir(
					DIDAR_CRM_PLUGIN_DIR,
					plugins_url( '', DIDAR_CRM_PLUGIN_FILE )
				);
			}
			if ( method_exists( \WPDev\Support\Assets::class, 'register_vendor_scripts' ) ) {
				\WPDev\Support\Assets::register_vendor_scripts();
			}
		}
	}
	didar_crm_register_modules();
	$config_file = is_readable( DIDAR_CRM_PLUGIN_DIR . 'wpdev.json' )
		? DIDAR_CRM_PLUGIN_DIR . 'wpdev.json'
		: null;
	if ( method_exists( \WPDev\Core\Plugin::class, 'boot' ) ) {
		\WPDev\Core\Plugin::boot( $config_file );
	}
	if ( method_exists( \WPDev\Core\Plugin::class, 'loader' ) ) {
		$loader = \WPDev\Core\Plugin::loader();
		if ( is_object( $loader ) && method_exists( $loader, 'boot_all' ) ) {
			$loader->boot_all();
		}
	}
}
