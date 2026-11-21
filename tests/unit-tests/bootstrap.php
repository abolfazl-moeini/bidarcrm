<?php
declare(strict_types=1);

$root = dirname(__DIR__, 1);

if (file_exists($root . '/vendor/autoload.php')) {
    require_once $root . '/vendor/autoload.php';
}

if (!defined('WP_TESTS_PHPUNIT_POLYFILLS_PATH')) {
    define('WP_TESTS_PHPUNIT_POLYFILLS_PATH', $root . '/vendor/yoast/phpunit-polyfills');
}

$tests_dir = getenv('WP_TESTS_DIR') ?: '';
if (!$tests_dir || !file_exists($tests_dir . '/includes/functions.php')) {
    if (file_exists('/tmp/wordpress-tests-lib/includes/functions.php')) {
        $tests_dir = '/tmp/wordpress-tests-lib';
    } elseif (file_exists('/tmp/wordpress-develop/tests/phpunit/includes/functions.php')) {
        $tests_dir = '/tmp/wordpress-develop/tests/phpunit';
    }
}

if ($tests_dir && file_exists($tests_dir . '/includes/functions.php')) {
    putenv("WP_TESTS_DIR={$tests_dir}");
    $_ENV['WP_TESTS_DIR'] = $tests_dir;
    $_SERVER['WP_TESTS_DIR'] = $tests_dir;

    if (class_exists(\WPDevTest\Setup::class)) {
        \WPDevTest\Setup::setup();
    }
} else {
    // Provide lightweight standard WordPress option/meta stubs for unit testing
    if (!isset($GLOBALS['didar_mock_options'])) {
        $GLOBALS['didar_mock_options'] = [];
    }
    if (!function_exists('get_option')) {
        function get_option(string $key, $default = false) {
            return $GLOBALS['didar_mock_options'][$key] ?? $default;
        }
    }
    if (!function_exists('update_option')) {
        function update_option(string $key, $value): bool {
            $GLOBALS['didar_mock_options'][$key] = $value;
            return true;
        }
    }
    if (!function_exists('delete_option')) {
        function delete_option(string $key): bool {
            unset($GLOBALS['didar_mock_options'][$key]);
            return true;
        }
    }
}
