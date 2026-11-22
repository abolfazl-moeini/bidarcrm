<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\BidarIran\Api\PostVoipWebhook;
use Espo\Modules\BidarIran\Services\VoipLookupService;
use PHPUnit\Framework\TestCase;

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
                $this->assertSame(
                    'Espo\\Modules\\BidarIran\\Api\\PostVoipWebhook',
                    $route['actionClassName'] ?? null
                );
            }
        }

        $this->assertTrue($found, 'POST /BidarVoip/webhook route must be registered with actionClassName and noAuth: true');
    }

    public function testAuthFailsOnMissingOrInvalidSecret(): void
    {
        $this->assertFalse($this->service->authenticate(null));
        $this->assertFalse($this->service->authenticate(''));
        $this->assertFalse($this->service->authenticate('wrong-secret'));
    }

    public function testAuthFailsClosedWhenConfiguredSecretIsEmpty(): void
    {
        $unconfiguredService = new VoipLookupService('');
        $this->assertFalse($unconfiguredService->authenticate(''));
        $this->assertFalse($unconfiguredService->authenticate(null));
        $this->assertFalse($unconfiguredService->authenticate('some-token'));
    }

    public function testAuthSucceedsOnExactSecretMatchingUsingHashEquals(): void
    {
        $this->assertTrue($this->service->authenticate('correct-secret-12345'));
    }

    public function testPostVoipWebhookImplementsEspoActionInterface(): void
    {
        $action = new PostVoipWebhook($this->service);
        $this->assertInstanceOf(Action::class, $action);
    }

    public function testPostVoipWebhookThrowsForbiddenOnInvalidSecret(): void
    {
        $action = new PostVoipWebhook($this->service);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->willReturnCallback(function (string $name) {
            return match ($name) {
                'X-Bidar-Voip-Secret' => 'invalid-secret',
                default => null,
            };
        });

        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public function testPostVoipWebhookProcessesSuccessfullyWithValidSecret(): void
    {
        $action = new PostVoipWebhook($this->service);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->willReturnCallback(function (string $name) {
            return match ($name) {
                'X-Bidar-Voip-Secret' => 'correct-secret-12345',
                default => null,
            };
        });
        $request->method('getParsedBody')->willReturn((object) ['phone' => '09123456789']);

        $response = $action->process($request);
        $this->assertInstanceOf(Response::class, $response);
        $this->assertSame(200, $response->getStatusCode());
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
