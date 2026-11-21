<?php
declare(strict_types=1);

namespace DidarCRMTest\TestCases;

use PHPUnit\Framework\TestCase as PhpUnitTestCase;

if (class_exists('WP_UnitTestCase') && class_exists(\WPDevTest\TestCases\TestCase::class)) {
    abstract class PluginBaseTestCase extends \WPDevTest\TestCases\TestCase {}
} else {
    abstract class PluginBaseTestCase extends PhpUnitTestCase {}
}
