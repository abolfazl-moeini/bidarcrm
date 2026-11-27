<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use PHPUnit\Framework\TestCase;

class ModuleManifestTest extends TestCase
{
    private string $extensionPath;

    protected function setUp(): void
    {
        $this->extensionPath = dirname(__DIR__, 2);
    }

    public function testManifestFileExistsAndHasValidStructure(): void
    {
        $manifestFile = $this->extensionPath . '/manifest.json';
        $this->assertFileExists($manifestFile, 'manifest.json must exist in extensions/bidar-sales');

        $content = file_get_contents($manifestFile);
        $this->assertIsString($content);

        $data = json_decode($content, true);
        $this->assertIsArray($data, 'manifest.json must be valid JSON');

        $this->assertSame('BidarSales', $data['name'] ?? null);
        $this->assertSame('1.0.5', $data['version'] ?? null);
        $this->assertContains('>=10.1.0', $data['acceptableVersions'] ?? []);
        $this->assertContains('>=8.3', $data['php'] ?? []);
        $this->assertStringNotContainsString('EspoCRM 10.1.4', $data['description'] ?? '');
        $this->assertStringContainsString('BidarCRM Extension', $data['description'] ?? '');
    }

    public function testBidarIranManifestWhitelabelDescription(): void
    {
        $manifestFile = dirname($this->extensionPath) . '/bidar-iran/manifest.json';
        $this->assertFileExists($manifestFile);
        $data = json_decode((string) file_get_contents($manifestFile), true);
        $this->assertIsArray($data);
        $this->assertStringNotContainsString('EspoCRM 10.1.4', $data['description'] ?? '');
        $this->assertStringContainsString('BidarCRM Extension', $data['description'] ?? '');
    }

    public function testModuleJsonExistsAndHasOrderFiftyOrHigher(): void
    {
        $moduleFile = $this->extensionPath . '/Resources/module.json';
        $this->assertFileExists($moduleFile, 'Resources/module.json must exist in extensions/bidar-sales');

        $content = file_get_contents($moduleFile);
        $this->assertIsString($content);

        $data = json_decode($content, true);
        $this->assertIsArray($data, 'module.json must be valid JSON');

        $this->assertArrayHasKey('order', $data);
        $this->assertGreaterThanOrEqual(50, $data['order'], 'order must be >= 50 so it loads after EspoCRM Crm module');
    }

    public function testAgplLicenseExists(): void
    {
        $licenseFile = $this->extensionPath . '/LICENSE';
        $this->assertFileExists($licenseFile, 'LICENSE must exist in extensions/bidar-sales');

        $content = file_get_contents($licenseFile);
        $this->assertIsString($content);
        $this->assertStringContainsString('GNU AFFERO GENERAL PUBLIC LICENSE', $content);
    }
}
