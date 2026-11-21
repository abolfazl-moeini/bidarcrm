<?php
declare(strict_types=1);

namespace DidarCRMTest\TestCases;

abstract class RestTestCase extends PluginBaseTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        global $wp_rest_server, $wp_actions;
        $wp_rest_server = null;
        if (isset($wp_actions['rest_api_init'])) {
            unset($wp_actions['rest_api_init']);
        }
        if (function_exists('rest_get_server')) {
            rest_get_server();
        }
    }
}
