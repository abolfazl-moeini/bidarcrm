<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use PHPUnit\Framework\TestCase;

class BidarUserApiKeyMetadataTest extends TestCase
{
    private string $metaPath;
    private string $resourcesPath;

    protected function setUp(): void
    {
        $this->resourcesPath = dirname(__DIR__, 2) . '/Resources';
        $this->metaPath = $this->resourcesPath . '/metadata';
    }

    public function testScopeDefinition(): void
    {
        $scopeFile = $this->metaPath . '/scopes/BidarUserApiKey.json';
        $this->assertFileExists($scopeFile);

        $scope = json_decode((string) file_get_contents($scopeFile), true);
        $this->assertIsArray($scope);
        $this->assertTrue($scope['entity'] ?? false);
        $this->assertFalse($scope['object'] ?? true);
        $this->assertFalse($scope['acl'] ?? true);
        $this->assertFalse($scope['tab'] ?? true);
    }

    public function testEntityDefsFields(): void
    {
        $entityDefFile = $this->metaPath . '/entityDefs/BidarUserApiKey.json';
        $this->assertFileExists($entityDefFile);

        $def = json_decode((string) file_get_contents($entityDefFile), true);
        $this->assertIsArray($def);

        $fields = $def['fields'] ?? [];
        $this->assertArrayHasKey('name', $fields);
        $this->assertTrue($fields['name']['required'] ?? false);

        $this->assertArrayHasKey('userId', $fields);
        $this->assertSame('foreignId', $fields['userId']['type'] ?? null);
        $this->assertTrue($fields['userId']['readOnly'] ?? false);

        $this->assertArrayHasKey('revokedByUserId', $fields);
        $this->assertTrue($fields['revokedByUserId']['readOnly'] ?? false);

        $this->assertArrayHasKey('user', $fields);
        $this->assertSame('link', $fields['user']['type'] ?? null);

        $this->assertArrayHasKey('keyPrefix', $fields);
        $this->assertSame('varchar', $fields['keyPrefix']['type'] ?? null);
        $this->assertSame(24, $fields['keyPrefix']['maxLength'] ?? null);

        $this->assertArrayHasKey('keyHash', $fields);
        $this->assertSame('varchar', $fields['keyHash']['type'] ?? null);
        $this->assertSame(64, $fields['keyHash']['maxLength'] ?? null);
        $this->assertTrue($fields['keyHash']['index'] ?? false);
        $this->assertTrue($fields['keyHash']['internal'] ?? false);

        $this->assertArrayHasKey('isActive', $fields);
        $this->assertSame('bool', $fields['isActive']['type'] ?? null);
        $this->assertTrue($fields['isActive']['default'] ?? false);

        $this->assertArrayHasKey('expiresAt', $fields);
        $this->assertSame('datetime', $fields['expiresAt']['type'] ?? null);

        $this->assertArrayHasKey('lastUsedAt', $fields);
        $this->assertSame('datetime', $fields['lastUsedAt']['type'] ?? null);

        $this->assertArrayHasKey('allowedIpList', $fields);
        $this->assertSame('array', $fields['allowedIpList']['type'] ?? null);

        // Links
        $links = $def['links'] ?? [];
        $this->assertArrayHasKey('user', $links);
        $this->assertSame('belongsTo', $links['user']['type'] ?? null);
        $this->assertSame('User', $links['user']['entity'] ?? null);

        // Indexes
        $indexes = $def['indexes'] ?? [];
        $this->assertArrayHasKey('keyHash', $indexes);
    }

    public function testAuthenticationMethodMetadata(): void
    {
        $authMethodFile = $this->metaPath . '/authenticationMethods/ApiKey.json';
        $this->assertFileExists($authMethodFile);

        $authMethod = json_decode((string) file_get_contents($authMethodFile), true);
        $this->assertIsArray($authMethod);
        $this->assertTrue($authMethod['api'] ?? false);
        $this->assertSame('X-Api-Key', $authMethod['credentialsHeader'] ?? null);
        $this->assertSame(
            'Espo\\Modules\\BidarSales\\Authentication\\BidarApiKeyLogin',
            $authMethod['implementationClassName'] ?? null
        );
    }

    public function testRoutesDefinition(): void
    {
        $routesFile = $this->resourcesPath . '/routes.json';
        $this->assertFileExists($routesFile);

        $routes = json_decode((string) file_get_contents($routesFile), true);
        $this->assertIsArray($routes);

        $routeMap = [];
        foreach ($routes as $route) {
            $key = strtoupper($route['method'] ?? '') . ' ' . ($route['route'] ?? '');
            $routeMap[$key] = $route['actionClassName'] ?? null;
        }

        $this->assertArrayHasKey('GET /BidarDashboard/summary', $routeMap);
        $this->assertArrayHasKey('GET /BidarApiKey', $routeMap);
        $this->assertSame('Espo\\Modules\\BidarSales\\Api\\BidarApiKeyListAction', $routeMap['GET /BidarApiKey']);

        $this->assertArrayHasKey('POST /BidarApiKey', $routeMap);
        $this->assertSame('Espo\\Modules\\BidarSales\\Api\\BidarApiKeyCreateAction', $routeMap['POST /BidarApiKey']);

        $this->assertArrayHasKey('POST /BidarApiKey/:id/rotate', $routeMap);
        $this->assertSame('Espo\\Modules\\BidarSales\\Api\\BidarApiKeyRotateAction', $routeMap['POST /BidarApiKey/:id/rotate']);

        $this->assertArrayHasKey('DELETE /BidarApiKey/:id', $routeMap);
        $this->assertSame('Espo\\Modules\\BidarSales\\Api\\BidarApiKeyDeleteAction', $routeMap['DELETE /BidarApiKey/:id']);

        $this->assertArrayHasKey('GET /BidarExport/:entityType', $routeMap);
        $this->assertSame('Espo\\Modules\\BidarSales\\Api\\BidarExportAction', $routeMap['GET /BidarExport/:entityType']);
    }

    public function testPersianI18nDefinition(): void
    {
        $i18nFile = $this->resourcesPath . '/i18n/fa_IR/BidarUserApiKey.json';
        $this->assertFileExists($i18nFile);

        $i18n = json_decode((string) file_get_contents($i18nFile), true);
        $this->assertIsArray($i18n);
        $this->assertArrayHasKey('fields', $i18n);
        $this->assertArrayHasKey('name', $i18n['fields']);
        $this->assertArrayHasKey('keyPrefix', $i18n['fields']);
        $this->assertArrayHasKey('keyHash', $i18n['fields']);
    }
}
