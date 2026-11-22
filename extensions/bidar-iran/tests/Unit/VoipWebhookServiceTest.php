<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarIran\Services\VoipLookupService;
use Espo\Modules\BidarIran\Api\PostVoipWebhook;

class VoipWebhookServiceTest extends TestCase
{
    private VoipLookupService $service;

    protected function setUp(): void
    {
        $this->service = new VoipLookupService('correct-secret-12345');
    }

    public function testRoutesJsonRegistersVoipWebhookWithNoAuth(): void
    {
        $routesFile = dirname(__DIR__, 2) . '/Resources/routes.json';
        $this->assertFileExists($routesFile);

        $routes = json_decode((string) file_get_contents($routesFile), true);
        $this->assertIsArray($routes);

        $found = false;
        foreach ($routes as $route) {
            if (($route['route'] ?? '') === '/BidarVoip/webhook' && ($route['method'] ?? '') === 'post') {
                $found = true;
                $this->assertTrue($route['noAuth'] ?? false);
                $this->assertSame('Espo\\Modules\\BidarIran\\Api\\PostVoipWebhook', $route['action'] ?? null);
            }
        }

        $this->assertTrue($found, 'POST /BidarVoip/webhook route must be registered with noAuth: true');
    }

    public function testAuthFailsOnMissingOrInvalidSecret(): void
    {
        $this->assertFalse($this->service->authenticate(null));
        $this->assertFalse($this->service->authenticate(''));
        $this->assertFalse($this->service->authenticate('wrong-secret'));
    }

    public function testAuthSucceedsOnExactSecretMatchingUsingHashEquals(): void
    {
        $this->assertTrue($this->service->authenticate('correct-secret-12345'));
    }

    public function testPhoneLookupMatchesCustomerAndOpenDeals(): void
    {
        $contacts = [
            [
                'id' => 'contact-1',
                'name' => 'علیرضا تهرانی',
                'phone' => '+989123456789',
                'accountId' => 'acc-1',
                'accountName' => 'فولاد گستر',
            ],
        ];

        $deals = [
            [
                'id' => 'deal-1',
                'name' => 'تأمین میلگرد پروژه پردیس',
                'amount' => 450000000,
                'stage' => 'Negotiation',
                'contactId' => 'contact-1',
            ],
        ];

        $result = $this->service->lookup('09123456789', $contacts, $deals);

        $this->assertTrue($result['found']);
        $this->assertSame('contact-1', $result['contact']['id']);
        $this->assertSame('علیرضا تهرانی', $result['contact']['name']);
        $this->assertSame('فولاد گستر', $result['contact']['accountName']);
        $this->assertCount(1, $result['deals']);
        $this->assertSame('تأمین میلگرد پروژه پردیس', $result['deals'][0]['name']);
    }

    public function testPhoneLookupReturnsUnknownForUnrecognizedCaller(): void
    {
        $result = $this->service->lookup('09350000000', [], []);

        $this->assertFalse($result['found']);
        $this->assertNull($result['contact']);
        $this->assertEmpty($result['deals']);
        $this->assertSame('+989350000000', $result['normalizedPhone']);
    }
}
