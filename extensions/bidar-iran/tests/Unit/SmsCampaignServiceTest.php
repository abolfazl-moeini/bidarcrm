<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use Espo\Core\Acl;
use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\BidarIran\Api\PostSendSms;
use Espo\Modules\BidarIran\Services\SmsCampaignService;
use Espo\Modules\BidarIran\Sms\KavenegarSender;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class SmsCampaignServiceTest extends TestCase
{
    private string $metaPath;

    protected function setUp(): void
    {
        $this->metaPath = dirname(__DIR__, 2) . '/Resources/metadata';
    }

    public function testMetadataScopesAndEntityDefsDefined(): void
    {
        // BidarSmsTemplate
        $tplScopeFile = $this->metaPath . '/scopes/BidarSmsTemplate.json';
        $this->assertFileExists($tplScopeFile);
        $tplScope = json_decode((string) file_get_contents($tplScopeFile), true);
        $this->assertTrue($tplScope['entity'] ?? false);
        $this->assertTrue($tplScope['tab'] ?? false);

        $tplDefFile = $this->metaPath . '/entityDefs/BidarSmsTemplate.json';
        $this->assertFileExists($tplDefFile);
        $tplDef = json_decode((string) file_get_contents($tplDefFile), true);
        $this->assertArrayHasKey('name', $tplDef['fields'] ?? []);
        $this->assertArrayHasKey('body', $tplDef['fields'] ?? []);
        $this->assertArrayHasKey('isActive', $tplDef['fields'] ?? []);

        // BidarSmsMessage
        $msgScopeFile = $this->metaPath . '/scopes/BidarSmsMessage.json';
        $this->assertFileExists($msgScopeFile);
        $msgScope = json_decode((string) file_get_contents($msgScopeFile), true);
        $this->assertTrue($msgScope['entity'] ?? false);
        $this->assertFalse($msgScope['tab'] ?? true);

        $msgDefFile = $this->metaPath . '/entityDefs/BidarSmsMessage.json';
        $this->assertFileExists($msgDefFile);
        $msgDef = json_decode((string) file_get_contents($msgDefFile), true);
        $msgFields = $msgDef['fields'] ?? [];
        $this->assertArrayHasKey('phoneNumber', $msgFields);
        $this->assertArrayHasKey('body', $msgFields);
        $this->assertArrayHasKey('status', $msgFields);
        $this->assertContains('sent', $msgFields['status']['options'] ?? []);
        $this->assertContains('scheduled', $msgFields['status']['options'] ?? []);
        $this->assertContains('failed', $msgFields['status']['options'] ?? []);
        $this->assertContains('received', $msgFields['status']['options'] ?? []);
        $this->assertArrayHasKey('contactId', $msgFields);
        $this->assertArrayHasKey('opportunityId', $msgFields);
    }

    public function testRoutesJsonRegistersBidarSmsSendAction(): void
    {
        $routesFile = dirname(__DIR__, 2) . '/Resources/routes.json';
        $this->assertFileExists($routesFile);

        $routes = json_decode((string) file_get_contents($routesFile), true);
        $this->assertIsArray($routes);

        $found = false;
        foreach ($routes as $route) {
            if (($route['route'] ?? '') === '/BidarSms/send' && ($route['method'] ?? '') === 'post') {
                $found = true;
                $this->assertSame(
                    'Espo\\Modules\\BidarIran\\Api\\PostSendSms',
                    $route['actionClassName'] ?? null
                );
            }
        }

        $this->assertTrue($found, 'POST /BidarSms/send route must be registered with actionClassName');
    }

    public function testRenderTemplateInterpolatesVariables(): void
    {
        $service = new SmsCampaignService();

        $template = 'سلام {contactName} عزیز از شرکت {accountName}. معامله {dealName} با موفقیت ثبت شد.';
        $rendered = $service->renderTemplate($template, [
            'contactName' => 'رضا حسینی',
            'accountName' => 'فناوران امید',
            'dealName' => 'خرید اشتراک سالانه',
        ]);

        $this->assertSame('سلام رضا حسینی عزیز از شرکت فناوران امید. معامله خرید اشتراک سالانه با موفقیت ثبت شد.', $rendered);
    }

    public function testSendSmsSuccessLogsToEntityManager(): void
    {
        $sender = $this->createMock(KavenegarSender::class);
        $sender->expects($this->once())
            ->method('sendDirect')
            ->with('09121112233', 'پیامک تستی')
            ->willReturn(true);

        $em = $this->createMock(EntityManager::class);
        $smsEntity = $this->createMock(Entity::class);

        $smsEntity->expects($this->exactly(5))
            ->method('set')
            ->willReturnCallback(function (string $name, $value) use ($smsEntity) {
                if ($name === 'status') {
                    $this->assertSame('sent', $value);
                } elseif ($name === 'phoneNumber') {
                    $this->assertSame('09121112233', $value);
                } elseif ($name === 'body') {
                    $this->assertSame('پیامک تستی', $value);
                } elseif ($name === 'contactId') {
                    $this->assertSame('c-10', $value);
                } elseif ($name === 'opportunityId') {
                    $this->assertSame('opp-20', $value);
                }
                return $smsEntity;
            });

        $smsEntity->method('getId')->willReturn('msg-uuid-1');

        $em->method('getNewEntity')->with('BidarSmsMessage')->willReturn($smsEntity);
        $em->expects($this->once())->method('saveEntity')->with($smsEntity);

        $service = new SmsCampaignService($sender, $em);
        $res = $service->sendSms('09121112233', 'پیامک تستی', 'c-10', 'opp-20');

        $this->assertTrue($res['success']);
        $this->assertSame('sent', $res['status']);
        $this->assertSame('09121112233', $res['phoneNumber']);
        $this->assertSame('msg-uuid-1', $res['id']);
    }

    public function testSendSmsFailureCatchesErrorAndLogsFailedStatus(): void
    {
        $sender = $this->createMock(KavenegarSender::class);
        $sender->expects($this->once())
            ->method('sendDirect')
            ->willThrowException(new RuntimeException('API key is invalid'));

        $em = $this->createMock(EntityManager::class);
        $smsEntity = $this->createMock(Entity::class);

        $smsEntity->expects($this->exactly(3))
            ->method('set')
            ->willReturnCallback(function (string $name, $value) use ($smsEntity) {
                if ($name === 'status') {
                    $this->assertSame('failed', $value);
                }
                return $smsEntity;
            });

        $em->method('getNewEntity')->with('BidarSmsMessage')->willReturn($smsEntity);
        $em->expects($this->once())->method('saveEntity')->with($smsEntity);

        $service = new SmsCampaignService($sender, $em);
        $res = $service->sendSms('09120000000', 'پیام خطا');

        $this->assertFalse($res['success']);
        $this->assertSame('failed', $res['status']);
        $this->assertStringContainsString('API key is invalid', $res['error'] ?? '');
    }

    public function testSendCampaignProcessesAllRecipients(): void
    {
        $sender = $this->createMock(KavenegarSender::class);
        $sender->method('sendDirect')->willReturn(true);

        $service = new SmsCampaignService($sender);

        $recipients = [
            [
                'phone' => '09121111111',
                'contactName' => 'علی',
                'accountName' => 'شرکت الف',
            ],
            [
                'phone' => '09122222222',
                'contactName' => 'مریم',
                'accountName' => 'شرکت ب',
            ],
        ];

        $template = 'درود {contactName} از {accountName}!';
        $campaign = $service->sendCampaign($recipients, $template);

        $this->assertSame(2, $campaign['total']);
        $this->assertSame(2, $campaign['sent']);
        $this->assertSame(0, $campaign['failed']);
        $this->assertCount(2, $campaign['results']);
        $this->assertSame('درود علی از شرکت الف!', $campaign['results'][0]['message']);
        $this->assertSame('درود مریم از شرکت ب!', $campaign['results'][1]['message']);
    }

    public function testPostSendSmsActionExecutesSingleAndBatch(): void
    {
        $sender = $this->createMock(KavenegarSender::class);
        $sender->method('sendDirect')->willReturn(true);

        $service = new SmsCampaignService($sender);
        $action = new PostSendSms($service);
        $this->assertInstanceOf(Action::class, $action);

        // Single Send Request
        $singleRequest = $this->createMock(Request::class);
        $singleRequest->method('getParsedBody')->willReturn((object) [
            'phone' => '09129998877',
            'message' => 'پیام تک کاربره',
        ]);

        $response = $action->process($singleRequest);
        $this->assertInstanceOf(Response::class, $response);
        $this->assertSame(200, $response->getStatusCode());

        // Batch Campaign Request
        $batchRequest = $this->createMock(Request::class);
        $batchRequest->method('getParsedBody')->willReturn((object) [
            'message' => 'پیام گروهی به {contactName}',
            'recipients' => [
                ['phone' => '09121110000', 'name' => 'کاربر ۱'],
                ['phone' => '09122220000', 'name' => 'کاربر ۲'],
            ],
        ]);

        $batchResponse = $action->process($batchRequest);
        $this->assertInstanceOf(Response::class, $batchResponse);
        $this->assertSame(200, $batchResponse->getStatusCode());
    }

    public function testPostSendSmsThrowsBadRequestOnMissingFields(): void
    {
        $action = new PostSendSms(new SmsCampaignService());

        $request = $this->createMock(Request::class);
        $request->method('getParsedBody')->willReturn((object) [
            'phone' => '',
            'message' => '',
        ]);

        $this->expectException(BadRequest::class);
        $action->process($request);
    }

    public function testGetTemplateBodyReturnsNullWhenInactiveOrEmpty(): void
    {
        $inactiveTpl = $this->createMock(Entity::class);
        $inactiveTpl->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'isActive' => false,
            'body' => 'متن غیرفعال',
            default => null,
        });

        $emptyTpl = $this->createMock(Entity::class);
        $emptyTpl->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'isActive' => true,
            'body' => '   ',
            default => null,
        });

        $activeTpl = $this->createMock(Entity::class);
        $activeTpl->method('get')->willReturnCallback(static fn(string $field) => match ($field) {
            'isActive' => true,
            'body' => 'سلام {contactName}',
            default => null,
        });

        $em = $this->createMock(EntityManager::class);
        $em->method('getEntityById')->willReturnCallback(static fn(string $type, string $id) => match ($id) {
            'tpl-inactive' => $inactiveTpl,
            'tpl-empty' => $emptyTpl,
            'tpl-active' => $activeTpl,
            default => null,
        });

        $service = new SmsCampaignService(null, $em);

        $this->assertNull($service->getTemplateBody('tpl-inactive'));
        $this->assertNull($service->getTemplateBody('tpl-empty'));
        $this->assertSame('سلام {contactName}', $service->getTemplateBody('tpl-active'));
    }

    public function testSendCampaignPreservesDefaultAccountNameWhenRecipientOmitsIt(): void
    {
        $sender = $this->createMock(KavenegarSender::class);
        $sender->method('sendDirect')->willReturn(true);

        $service = new SmsCampaignService($sender);
        $result = $service->sendCampaign(
            [['phone' => '09121111111', 'contactName' => 'علی']],
            'سلام {contactName} از {accountName}',
            ['accountName' => 'شرکت پیش‌فرض']
        );

        $this->assertSame(1, $result['sent']);
        $this->assertSame('سلام علی از شرکت پیش‌فرض', $result['results'][0]['message']);
    }

    public function testRenderTemplateHandlesNonScalarVariablesAndSkipsEmptyKeys(): void
    {
        $service = new SmsCampaignService();
        $rendered = $service->renderTemplate(
            'سلام {contactName} {} {bad}',
            [
                '' => 'ignored',
                '{}' => 'ignored',
                'contactName' => 'علی',
                'bad' => ['nested'],
                'obj' => new \stdClass(),
            ]
        );

        $this->assertSame('سلام علی {} {bad}', $rendered);
    }

    public function testPostSendSmsEnforcesAclPermissions(): void
    {
        $sender = $this->createMock(KavenegarSender::class);
        $sender->method('sendDirect')->willReturn(true);
        $service = new SmsCampaignService($sender);

        // Denied BidarSmsMessage create
        $aclDenyMessage = $this->createMock(Acl::class);
        $aclDenyMessage->method('check')->with('BidarSmsMessage', 'create')->willReturn(false);

        $action1 = new PostSendSms($service, null, null, $aclDenyMessage);
        $req1 = $this->createMock(Request::class);
        $req1->method('getParsedBody')->willReturn((object) ['phone' => '09121110000', 'message' => 'تست']);

        try {
            $action1->process($req1);
            $this->fail('Expected Forbidden when BidarSmsMessage create is denied');
        } catch (Forbidden) {
            $this->assertTrue(true);
        }

        // Denied BidarSmsTemplate read when templateId is set
        $aclDenyTemplate = $this->createMock(Acl::class);
        $aclDenyTemplate->method('check')->willReturnCallback(static fn(string $scope, string $action) => match ([$scope, $action]) {
            ['BidarSmsMessage', 'create'] => true,
            ['BidarSmsTemplate', 'read'] => false,
            default => false,
        });

        $action2 = new PostSendSms($service, null, null, $aclDenyTemplate);
        $req2 = $this->createMock(Request::class);
        $req2->method('getParsedBody')->willReturn((object) [
            'phone' => '09121110000',
            'templateId' => 'tpl-1',
            'message' => 'تست',
        ]);

        $this->expectException(Forbidden::class);
        $action2->process($req2);
    }

    public function testPostSendSmsHandlesRealJsonStdClassNestedRecipientsAndVariables(): void
    {
        $dispatched = [];
        $sender = $this->createMock(KavenegarSender::class);
        $sender->method('sendDirect')->willReturnCallback(static function (string $phone, string $msg) use (&$dispatched): bool {
            $dispatched[] = [$phone, $msg];
            return true;
        });

        $action = new PostSendSms(new SmsCampaignService($sender));
        $payload = json_decode(
            '{"message":"سلام {contactName} از {company} ({extra})","variables":{"company":"بیدار"},"recipients":[{"phone":"09121110000","contactName":"علی","variables":{"extra":"۱"}}]}',
            false
        );

        $request = $this->createMock(Request::class);
        $request->method('getParsedBody')->willReturn($payload);

        $response = $action->process($request);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame([['09121110000', 'سلام علی از بیدار (۱)']], $dispatched);
    }

    public function testPostSendSmsRejectsInvalidVariablesRecipientsPhoneOrTemplateId(): void
    {
        $action = new PostSendSms(new SmsCampaignService());

        $invalidPayloads = [
            (object) ['phone' => '09121110000', 'message' => 'hi', 'variables' => 'bad'],
            (object) ['message' => 'hi', 'recipients' => '09121110000'],
            (object) ['message' => 'hi', 'recipients' => ['not-an-object']],
            (object) ['phone' => ['09121110000'], 'message' => 'hi'],
            (object) ['phone' => '09121110000', 'templateId' => ['tpl-1']],
        ];

        foreach ($invalidPayloads as $payload) {
            $request = $this->createMock(Request::class);
            $request->method('getParsedBody')->willReturn($payload);
            try {
                $action->process($request);
                $this->fail('Expected BadRequest for invalid payload: ' . json_encode($payload));
            } catch (BadRequest) {
                $this->assertTrue(true);
            }
        }
    }

    public function testSendSmsPersistsProviderMessageIdAndSurfacesLogErrorOnSaveFailure(): void
    {
        $sender = new KavenegarSender('api-key-123', '10008000', static fn(): array => [
            'status' => 200,
            'body' => json_encode([
                'return' => ['status' => 200, 'message' => 'تایید شد'],
                'entries' => [['messageid' => 987654321]],
            ]),
        ]);

        $recorded = [];
        $smsEntity = $this->createMock(Entity::class);
        $smsEntity->method('set')->willReturnCallback(static function (string $k, $v) use (&$recorded, $smsEntity) {
            $recorded[$k] = $v;
            return $smsEntity;
        });
        $smsEntity->method('getId')->willReturn('msg-99');

        $em = $this->createMock(EntityManager::class);
        $em->method('getNewEntity')->with('BidarSmsMessage')->willReturn($smsEntity);
        $em->expects($this->once())->method('saveEntity')->with($smsEntity);

        $service = new SmsCampaignService($sender, $em);
        $res = $service->sendSms('+989121112233', 'تست ثبت شناسه');
        $this->assertTrue($res['success']);
        $this->assertSame('09121112233', $recorded['phoneNumber'] ?? null);
        $this->assertSame('987654321', $recorded['providerMessageId'] ?? null);
        $this->assertArrayNotHasKey('logError', $res);

        // Save failure sets logError without overriding dispatch success
        $emFail = $this->createMock(EntityManager::class);
        $emFail->method('getNewEntity')->with('BidarSmsMessage')->willReturn($smsEntity);
        $emFail->method('saveEntity')->willThrowException(new RuntimeException('DB write error'));

        $resFailLog = (new SmsCampaignService($sender, $emFail))->sendSms('09121112233', 'تست خطای لاگ');
        $this->assertTrue($resFailLog['success']);
        $this->assertNull($resFailLog['id']);
        $this->assertSame('SMS dispatch result could not be logged.', $resFailLog['logError'] ?? null);
    }

    public function testPostSendSmsNormalizesBlankContactAndOpportunityIdsToNull(): void
    {
        $captured = [];
        $service = new class extends SmsCampaignService {
            /** @var array<int, array<string, mixed>> */
            public array $calls = [];
            public function __construct() {}
            public function sendSms(string $phoneNumber, string $message, ?string $contactId = null, ?string $opportunityId = null): array
            {
                $this->calls[] = compact('phoneNumber', 'message', 'contactId', 'opportunityId');
                return ['success' => true, 'status' => 'sent', 'phoneNumber' => $phoneNumber, 'message' => $message, 'id' => '1'];
            }
        };

        $req = $this->createMock(Request::class);
        $req->method('getParsedBody')->willReturn((object) [
            'phone' => '09121110000',
            'message' => 'تست',
            'contactId' => '   ',
            'opportunityId' => '',
        ]);

        $res = (new PostSendSms($service))->process($req);
        $this->assertSame(200, $res->getStatusCode());
        $this->assertNull($service->calls[0]['contactId']);
        $this->assertNull($service->calls[0]['opportunityId']);
    }
}
