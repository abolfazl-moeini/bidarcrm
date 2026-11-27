<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use Espo\Core\Sms\Sender;
use Espo\Core\Sms\Sms;
use Espo\Modules\BidarIran\Sms\KavenegarSender;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class KavenegarSenderTest extends TestCase
{
    public function testManifestAndSmsProviderRegistration(): void
    {
        $modulePath = dirname(__DIR__, 2);
        $manifestFile = $modulePath . '/manifest.json';
        $this->assertFileExists($manifestFile);

        $manifest = json_decode((string) file_get_contents($manifestFile), true);
        $this->assertSame('BidarIran', $manifest['name'] ?? null);

        $providerFile = $modulePath . '/Resources/metadata/app/smsProviders.json';
        $this->assertFileExists($providerFile);

        $providers = json_decode((string) file_get_contents($providerFile), true);
        $this->assertArrayHasKey('Kavenegar', $providers);
        $this->assertSame(
            'Espo\\Modules\\BidarIran\\Sms\\KavenegarSender',
            $providers['Kavenegar']['senderClassName'] ?? null
        );
    }

    public function testKavenegarSenderImplementsEspoSmsSenderInterface(): void
    {
        $sender = new KavenegarSender('test-key');
        $this->assertInstanceOf(Sender::class, $sender);
    }

    public function testKavenegarSenderSendsSmsViaSenderInterface(): void
    {
        $httpCalls = [];
        $fakeHttp = function (string $url, array $params) use (&$httpCalls): array {
            $httpCalls[] = ['url' => $url, 'params' => $params];
            return [
                'status' => 200,
                'body' => json_encode([
                    'return' => ['status' => 200, 'message' => 'تایید شد'],
                    'entries' => [['messageid' => 123456]],
                ]),
            ];
        };

        $sender = new KavenegarSender('secret-api-key', '10008000', $fakeHttp);

        $sms = $this->createMock(Sms::class);
        $sms->method('getToNumberList')->willReturn(['+989123456789']);
        $sms->method('getBody')->willReturn('کد تایید شما: ۱۲۳۴');

        $sender->send($sms);

        $this->assertCount(1, $httpCalls);
        $this->assertStringContainsString('secret-api-key', $httpCalls[0]['url']);
        $this->assertSame('09123456789', $httpCalls[0]['params']['receptor']);
        $this->assertSame('10008000', $httpCalls[0]['params']['sender']);
        $this->assertSame('کد تایید شما: ۱۲۳۴', $httpCalls[0]['params']['message']);
    }

    public function testKavenegarSenderSendDirectSendsSuccessfully(): void
    {
        $httpCalls = [];
        $fakeHttp = function (string $url, array $params) use (&$httpCalls): array {
            $httpCalls[] = ['url' => $url, 'params' => $params];
            return [
                'status' => 200,
                'body' => json_encode([
                    'return' => ['status' => 200, 'message' => 'تایید شد'],
                    'entries' => [['messageid' => 123456]],
                ]),
            ];
        };

        $sender = new KavenegarSender('secret-api-key', '10008000', $fakeHttp);
        $result = $sender->sendDirect('+989123456789', 'کد تایید شما: ۱۲۳۴');

        $this->assertTrue($result);
        $this->assertCount(1, $httpCalls);
    }

    public function testKavenegarSenderFailsOnEmptyApiKey(): void
    {
        $sender = new KavenegarSender('');
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('API key is not configured');
        $sender->sendDirect('09123456789', 'تست');
    }

    public function testKavenegarSenderThrowsOnApiErrorCodeInBody(): void
    {
        $fakeHttp = function (): array {
            return [
                'status' => 200,
                'body' => json_encode([
                    'return' => ['status' => 411, 'message' => 'اعتبار کافی نیست'],
                ]),
            ];
        };

        $sender = new KavenegarSender('api-key-test', '10008000', $fakeHttp);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('411');
        $sender->sendDirect('09123456789', 'تست');
    }

    public function testKavenegarSenderMasksApiKeyOnFailure(): void
    {
        $fakeHttp = function (): array {
            return [
                'status' => 401,
                'body' => json_encode(['return' => ['status' => 401, 'message' => 'API Key Invalid']]),
            ];
        };

        $sender = new KavenegarSender('very-sensitive-key-xyz', '10008000', $fakeHttp);

        try {
            $sender->sendDirect('09123456789', 'تست خطا');
            $this->fail('Expected exception was not thrown');
        } catch (RuntimeException $e) {
            $this->assertStringNotContainsString('very-sensitive-key-xyz', $e->getMessage());
            $this->assertStringContainsString('Kavenegar SMS dispatch failed', $e->getMessage());
        }
    }

    public function testRejectsEmptyMalformedAndIncompleteSuccessfulResponses(): void
    {
        foreach (['', '<html>502</html>', '{}'] as $body) {
            $sender = new KavenegarSender('test-key', null, static fn() => ['status' => 200, 'body' => $body]);
            try {
                $sender->sendDirect('09123456789', 'message');
                $this->fail('Expected malformed provider response to fail.');
            } catch (RuntimeException) {
                $this->assertTrue(true);
            }
        }
    }

    public function testDoesNotLeakApiKeyFromPreviousCurlException(): void
    {
        $key = 'sensitive-key-77';
        $sender = new KavenegarSender($key, null, static function (string $url) use ($key): array {
            throw new RuntimeException('cURL failed for ' . $url . '?key=' . $key);
        });
        try {
            $sender->sendDirect('09123456789', 'message');
            $this->fail('Expected sender failure.');
        } catch (RuntimeException $exception) {
            $this->assertStringNotContainsString($key, $exception->getMessage());
            $this->assertStringNotContainsString($key, $exception->getPrevious()?->getMessage() ?? '');
        }
    }

    public function testOmitsEmptySenderLineAndRejectsInvalidMessageOrLandline(): void
    {
        foreach ([null, ''] as $senderLine) {
            $calls = [];
            $sender = new KavenegarSender('key', $senderLine, static function ($url, $params) use (&$calls): array {
                $calls[] = $params;
                return ['status' => 200, 'body' => '{"return":{"status":200}}'];
            });
            $sender->sendDirect('09123456789', 'message');
            $this->assertArrayNotHasKey('sender', $calls[0]);
        }
        $sender = new KavenegarSender('key', null, static fn() => ['status' => 200, 'body' => '{"return":{"status":200}}']);
        foreach ([['09123456789', ''], ['09123456789', '   '], ['02188776655', 'message']] as [$phone, $message]) {
            try {
                $sender->sendDirect($phone, $message);
                $this->fail('Expected invalid dispatch arguments to fail.');
            } catch (RuntimeException) {
                $this->assertTrue(true);
            }
        }
    }

    public function testDisabledKavenegarIntegrationIsRejected(): void
    {
        $integration = $this->createMock(\Espo\ORM\Entity::class);
        $integration->method('get')->willReturnCallback(static fn($field) => match ($field) {
            'apiKey' => 'configured-key', 'enabled' => false, default => null,
        });
        $integration->method('has')->willReturn(false);
        $em = $this->createMock(\Espo\ORM\EntityManager::class);
        $em->method('getEntityById')->with('Integration', 'Kavenegar')->willReturn($integration);
        $sender = new KavenegarSender(null, null, static fn() => ['status' => 200, 'body' => '{"return":{"status":200}}'], null, $em);
        $this->expectException(RuntimeException::class);
        $sender->sendDirect('09123456789', 'message');
    }
}
