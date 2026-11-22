<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use Espo\Modules\BidarIran\Sms\KavenegarSender;

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

    public function testKavenegarSenderSendsSmsViaHttpClient(): void
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
        $result = $sender->send('+989123456789', 'کد تایید شما: ۱۲۳۴');

        $this->assertTrue($result);
        $this->assertCount(1, $httpCalls);
        $this->assertStringContainsString('secret-api-key', $httpCalls[0]['url']);
        $this->assertSame('09123456789', $httpCalls[0]['params']['receptor']);
        $this->assertSame('10008000', $httpCalls[0]['params']['sender']);
        $this->assertSame('کد تایید شما: ۱۲۳۴', $httpCalls[0]['params']['message']);
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
            $sender->send('09123456789', 'تست خطا');
            $this->fail('Expected exception was not thrown');
        } catch (RuntimeException $e) {
            $this->assertStringNotContainsString('very-sensitive-key-xyz', $e->getMessage());
            $this->assertStringContainsString('Kavenegar SMS dispatch failed', $e->getMessage());
        }
    }
}
