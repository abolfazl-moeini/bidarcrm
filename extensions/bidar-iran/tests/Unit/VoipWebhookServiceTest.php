<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Container;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\BidarIran\Api\PostVoipWebhook;
use Espo\Modules\BidarIran\Services\VoipLookupService;
use Espo\ORM\Entity;
use Espo\ORM\EntityCollection;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\RDBRepository;
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

    public function testDefaultConstructorFailsClosed(): void
    {
        $service = new VoipLookupService();
        $this->assertFalse($service->authenticate(null));
        $this->assertFalse($service->authenticate('anything'));
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

    public function testPhoneLookupMatchesLandlinesAcrossLocalAndInternationalFormats(): void
    {
        $result = $this->service->lookup('02188776655', [[
            'id' => 'contact-landline', 'phone' => '+982188776655',
        ]], []);
        $this->assertTrue($result['found']);
        $this->assertSame('contact-landline', $result['contact']['id']);
    }

    public function testPhoneLookupDoesNotLinkDealsWithoutContactIdAndNullsInvalidPhone(): void
    {
        foreach ([null, ''] as $contactId) {
            $contact = ['phone' => '09123456789'];
            if ($contactId !== null) {
                $contact['id'] = $contactId;
            }
            $result = $this->service->lookup('09123456789', [$contact], [
                ['contactId' => '', 'id' => 'must-not-match'],
            ]);
            $this->assertSame([], $result['deals']);
        }
        $invalid = $this->service->lookup('101', [], []);
        $this->assertNull($invalid['normalizedPhone']);
    }

    public function testShortNonIranianCallerIsSuccessfulUnknownResponse(): void
    {
        $action = new PostVoipWebhook($this->service);
        $request = $this->createMock(Request::class);
        $request->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $request->method('getParsedBody')->willReturn((object) ['phone' => '101']);
        $response = $action->process($request);
        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getBody(), true);
        $this->assertFalse($data['found']);
    }

    public function testPostVoipWebhookResolvesEntityManagerFromContainerAndQueriesFilteredContactAndOpportunity(): void
    {
        $integration = $this->createMock(Entity::class);
        $integration->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'webhookSecret' => 'correct-secret-12345',
            'enabled' => true,
            default => null,
        });

        $contact = $this->createMock(Entity::class);
        $contact->method('getId')->willReturn('c-1');
        $contact->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'name' => 'علیرضا تهرانی',
            'phoneNumber' => '+989123456789',
            'accountId' => 'acc-1',
            'accountName' => 'فولاد گستر',
            default => null,
        });

        $contactCollection = new EntityCollection([$contact]);

        $contactRepo = $this->createMock(RDBRepository::class);
        $contactRepo->method('select')->willReturnSelf();
        $contactRepo->expects($this->once())
            ->method('where')
            ->with($this->callback(static fn(array $where): bool => array_key_exists('phoneNumber', $where)))
            ->willReturnSelf();
        $contactRepo->expects($this->once())->method('limit')->with(0, 1)->willReturnSelf();
        $contactRepo->method('find')->willReturn($contactCollection);

        $opp = $this->createMock(Entity::class);
        $opp->method('getId')->willReturn('opp-1');
        $opp->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'name' => 'معامله اول',
            'amountConverted' => 500000,
            'stage' => 'Negotiation',
            'contactId' => 'c-1',
            default => null,
        });

        $oppCollection = new EntityCollection([$opp]);

        $oppRepo = $this->createMock(RDBRepository::class);
        $oppRepo->method('select')->willReturnSelf();
        $oppRepo->expects($this->once())
            ->method('where')
            ->with($this->callback(static function (array $where): bool {
                return ($where['stage!='] ?? null) === ['Closed Won', 'Closed Lost']
                    && !array_key_exists('stageProbability!=', $where)
                    && ($where['contactId'] ?? null) === 'c-1';
            }))
            ->willReturnSelf();
        $oppRepo->expects($this->once())->method('limit')->with(0, 20)->willReturnSelf();
        $oppRepo->method('find')->willReturn($oppCollection);

        $em = $this->createMock(EntityManager::class);
        $em->method('getEntityById')->with('Integration', 'BidarVoip')->willReturn($integration);
        $em->method('getRDBRepository')->willReturnCallback(static fn(string $entityType) => match ($entityType) {
            'Contact' => $contactRepo,
            'Opportunity' => $oppRepo,
            default => null,
        });

        $container = $this->createMock(Container::class);
        $container->method('has')->with('entityManager')->willReturn(true);
        $container->method('get')->with('entityManager')->willReturn($em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $request->method('getParsedBody')->willReturn((object) ['phone' => '09123456789']);

        $action = new PostVoipWebhook(null, null, $container);
        $response = $action->process($request);

        $this->assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getBody(), true);
        $this->assertTrue($data['found']);
        $this->assertSame('c-1', $data['contact']['id']);
        $this->assertCount(1, $data['deals']);
        $this->assertSame('opp-1', $data['deals'][0]['id']);
    }

    public function testPostVoipWebhookRejectsDisabledIntegrationWithForbidden(): void
    {
        $integration = $this->createMock(Entity::class);
        $integration->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'webhookSecret' => 'correct-secret-12345',
            'enabled' => false,
            default => null,
        });

        $em = $this->createMock(EntityManager::class);
        $em->method('getEntityById')->with('Integration', 'BidarVoip')->willReturn($integration);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $request->method('getParsedBody')->willReturn((object) ['phone' => '09123456789']);

        $action = new PostVoipWebhook(null, $em);
        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public function testPostVoipWebhookRejectsArrayPhoneAndIgnoresQueryParamPhone(): void
    {
        $action = new PostVoipWebhook($this->service);

        $arrayPhoneRequest = $this->createMock(Request::class);
        $arrayPhoneRequest->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $arrayPhoneRequest->method('getParsedBody')->willReturn((object) ['phone' => ['09123456789']]);

        try {
            $action->process($arrayPhoneRequest);
            $this->fail('Expected BadRequest for array phone');
        } catch (BadRequest) {
            $this->assertTrue(true);
        }

        $queryParamRequest = $this->createMock(Request::class);
        $queryParamRequest->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $queryParamRequest->method('getParsedBody')->willReturn((object) []);
        $queryParamRequest->method('getQueryParam')->with('phone')->willReturn('09123456789');

        $this->expectException(BadRequest::class);
        $action->process($queryParamRequest);
    }

    public function testPostVoipWebhookValidatesHmacSignatureAndTimestampReplayWindow(): void
    {
        $hmacSecret = 'hmac-secret-xyz';
        $rawBody = '{"phone":"09123456789"}';

        $integration = $this->createMock(Entity::class);
        $integration->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'webhookSecret' => 'correct-secret-12345',
            'enabled' => true,
            'hmacSecret' => $hmacSecret,
            default => null,
        });

        $em = $this->createMock(EntityManager::class);
        $em->method('getEntityById')->with('Integration', 'BidarVoip')->willReturn($integration);
        $em->method('getRDBRepository')->willReturn($this->createMock(RDBRepository::class));

        $action = new PostVoipWebhook(null, $em);

        // Valid HMAC + fresh timestamp
        $now = (string) time();
        $validSig = hash_hmac('sha256', $now . '.' . $rawBody, $hmacSecret);
        $validReq = $this->createMock(Request::class);
        $validReq->method('getBodyContents')->willReturn($rawBody);
        $validReq->method('getParsedBody')->willReturn(json_decode($rawBody, false));
        $validReq->method('getHeader')->willReturnCallback(static fn(string $name) => match ($name) {
            'X-Bidar-Voip-Secret' => 'correct-secret-12345',
            'X-Bidar-Voip-Timestamp' => $now,
            'X-Bidar-Voip-Signature' => $validSig,
            default => null,
        });
        $this->assertSame(200, $action->process($validReq)->getStatusCode());

        // Expired timestamp (> 300s)
        $oldTs = (string) (time() - 301);
        $oldSig = hash_hmac('sha256', $oldTs . '.' . $rawBody, $hmacSecret);
        $expiredReq = $this->createMock(Request::class);
        $expiredReq->method('getBodyContents')->willReturn($rawBody);
        $expiredReq->method('getParsedBody')->willReturn(json_decode($rawBody, false));
        $expiredReq->method('getHeader')->willReturnCallback(static fn(string $name) => match ($name) {
            'X-Bidar-Voip-Secret' => 'correct-secret-12345',
            'X-Bidar-Voip-Timestamp' => $oldTs,
            'X-Bidar-Voip-Signature' => $oldSig,
            default => null,
        });
        try {
            $action->process($expiredReq);
            $this->fail('Expected Forbidden for expired HMAC timestamp');
        } catch (Forbidden) {
            $this->assertTrue(true);
        }

        // Invalid signature
        $badSigReq = $this->createMock(Request::class);
        $badSigReq->method('getBodyContents')->willReturn($rawBody);
        $badSigReq->method('getParsedBody')->willReturn(json_decode($rawBody, false));
        $badSigReq->method('getHeader')->willReturnCallback(static fn(string $name) => match ($name) {
            'X-Bidar-Voip-Secret' => 'correct-secret-12345',
            'X-Bidar-Voip-Timestamp' => $now,
            'X-Bidar-Voip-Signature' => 'deadbeef',
            default => null,
        });
        $this->expectException(Forbidden::class);
        $action->process($badSigReq);
    }

    public function testPostVoipWebhookMatchesSecondaryPhoneViaContactAndEntityPhoneNumberFallback(): void
    {
        $integration = $this->createMock(Entity::class);
        $integration->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'webhookSecret' => 'correct-secret-12345',
            'enabled' => true,
            default => null,
        });

        // Case 1: Contact matched by secondary number while primary phoneNumber differs
        $contact = $this->createMock(Entity::class);
        $contact->method('getId')->willReturn('c-sec-1');
        $contact->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'name' => 'مریم کریمی',
            'phoneNumber' => '+989121111111',
            'accountId' => 'acc-2',
            'accountName' => 'پارس تک',
            default => null,
        });

        $contactRepo = $this->createMock(RDBRepository::class);
        $contactRepo->method('select')->willReturnSelf();
        $contactRepo->method('where')->willReturnSelf();
        $contactRepo->expects($this->once())->method('limit')->with(0, 1)->willReturnSelf();
        $contactRepo->method('find')->willReturn(new EntityCollection([$contact]));

        $oppRepo = $this->createMock(RDBRepository::class);
        $oppRepo->method('select')->willReturnSelf();
        $oppRepo->method('where')->willReturnSelf();
        $oppRepo->expects($this->exactly(2))->method('limit')->with(0, 20)->willReturnSelf();
        $oppRepo->method('find')->willReturn(new EntityCollection([]));

        $em = $this->createMock(EntityManager::class);
        $em->method('getEntityById')->with('Integration', 'BidarVoip')->willReturn($integration);
        $em->method('getRDBRepository')->willReturnCallback(static fn(string $entityType) => match ($entityType) {
            'Contact' => $contactRepo,
            'Opportunity' => $oppRepo,
            default => null,
        });

        $req = $this->createMock(Request::class);
        $req->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $req->method('getParsedBody')->willReturn((object) ['phone' => '02188776655']);

        $res = (new PostVoipWebhook(null, $em))->process($req);
        $data = json_decode((string) $res->getBody(), true);
        $this->assertTrue($data['found']);
        $this->assertSame('c-sec-1', $data['contact']['id']);
        $this->assertArrayNotHasKey('matchedPhone', $data['contact']);

        // Case 2: Contact query misses -> PhoneNumber + EntityPhoneNumber fallback succeeds
        $contactRepoEmpty = $this->createMock(RDBRepository::class);
        $contactRepoEmpty->method('select')->willReturnSelf();
        $contactRepoEmpty->method('where')->willReturnSelf();
        $contactRepoEmpty->method('limit')->willReturnSelf();
        $contactRepoEmpty->method('find')->willReturn(new EntityCollection([]));

        $phoneEntity = $this->createMock(Entity::class);
        $phoneEntity->method('getId')->willReturn('pn-1');
        $phoneEntity->method('get')->willReturnCallback(static fn(string $field) => $field === 'name' ? '+982188776655' : null);

        $phoneRepo = $this->createMock(RDBRepository::class);
        $phoneRepo->method('select')->willReturnSelf();
        $phoneRepo->method('where')->willReturnSelf();
        $phoneRepo->expects($this->once())->method('limit')->with(0, 20)->willReturnSelf();
        $phoneRepo->method('find')->willReturn(new EntityCollection([$phoneEntity]));

        $linkEntity = $this->createMock(Entity::class);
        $linkEntity->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'entityType' => 'Contact',
            'entityId' => 'c-sec-2',
            'phoneNumberId' => 'pn-1',
            default => null,
        });

        $entityPhoneRepo = $this->createMock(RDBRepository::class);
        $entityPhoneRepo->method('select')->willReturnSelf();
        $entityPhoneRepo->method('where')->willReturnSelf();
        $entityPhoneRepo->expects($this->once())->method('limit')->with(0, 20)->willReturnSelf();
        $entityPhoneRepo->method('find')->willReturn(new EntityCollection([$linkEntity]));

        $contact2 = $this->createMock(Entity::class);
        $contact2->method('getId')->willReturn('c-sec-2');
        $contact2->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'name' => 'سهراب سپهری',
            'phoneNumber' => '+989129999999',
            'accountId' => null,
            'accountName' => null,
            default => null,
        });

        $em2 = $this->createMock(EntityManager::class);
        $em2->method('getEntityById')->willReturnCallback(static fn(string $entityType, string $id) => match ([$entityType, $id]) {
            ['Integration', 'BidarVoip'] => $integration,
            ['Contact', 'c-sec-2'] => $contact2,
            default => null,
        });
        $em2->method('getRDBRepository')->willReturnCallback(static fn(string $entityType) => match ($entityType) {
            'Contact' => $contactRepoEmpty,
            'PhoneNumber' => $phoneRepo,
            'EntityPhoneNumber' => $entityPhoneRepo,
            'Opportunity' => $oppRepo,
            default => null,
        });

        $res2 = (new PostVoipWebhook(null, $em2))->process($req);
        $data2 = json_decode((string) $res2->getBody(), true);
        $this->assertTrue($data2['found']);
        $this->assertSame('c-sec-2', $data2['contact']['id']);
    }

    public function testPostVoipWebhookEnforcesAllowedIps(): void
    {
        $integration = $this->createMock(Entity::class);
        $integration->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'webhookSecret' => 'correct-secret-12345',
            'enabled' => true,
            'allowedIps' => '10.0.0.5, 192.168.1.10',
            default => null,
        });

        $em = $this->createMock(EntityManager::class);
        $em->method('getEntityById')->with('Integration', 'BidarVoip')->willReturn($integration);
        $em->method('getRDBRepository')->willReturn($this->createMock(RDBRepository::class));

        $action = new PostVoipWebhook(null, $em);

        $allowedReq = $this->createMock(Request::class);
        $allowedReq->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $allowedReq->method('getServerParam')->with('REMOTE_ADDR')->willReturn('192.168.1.10');
        $allowedReq->method('getParsedBody')->willReturn((object) ['phone' => '09123456789']);
        $this->assertSame(200, $action->process($allowedReq)->getStatusCode());

        $deniedReq = $this->createMock(Request::class);
        $deniedReq->method('getHeader')->willReturnCallback(static fn(string $name) => $name === 'X-Bidar-Voip-Secret' ? 'correct-secret-12345' : null);
        $deniedReq->method('getServerParam')->with('REMOTE_ADDR')->willReturn('203.0.113.99');
        $deniedReq->method('getParsedBody')->willReturn((object) ['phone' => '09123456789']);
        $this->expectException(Forbidden::class);
        $action->process($deniedReq);
    }
}
