<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Sms;

use Closure;
use Espo\Core\Sms\Sender;
use Espo\Core\Sms\Sms;
use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;
use Espo\ORM\EntityManager;
use RuntimeException;

class KavenegarSender implements Sender
{
    private string $apiKey;
    private ?string $senderLine;
    private IranPhoneNormalizer $normalizer;
    private Closure $httpClient;
    private bool $enabled = true;
    private ?string $lastProviderMessageId = null;

    /** @param ?Closure(string, array<string, mixed>): array{status: int, body: string} $httpClient */
    public function __construct(?string $apiKey = null, ?string $senderLine = null, ?Closure $httpClient = null, ?IranPhoneNormalizer $normalizer = null, ?EntityManager $entityManager = null)
    {
        if (($apiKey === null || $apiKey === '') && $entityManager !== null) {
            $integration = $entityManager->getEntityById('Integration', 'Kavenegar');
            if ($integration !== null) {
                $this->enabled = $integration->get('enabled') !== false;
                $apiKey = (string) ($integration->get('apiKey') ?? '');
                $senderLine = $senderLine ?? ($integration->has('senderLine') ? (string) $integration->get('senderLine') : null);
            }
        }
        if (!$this->enabled) $apiKey = '';
        $this->apiKey = trim($apiKey ?? '');
        $this->senderLine = $senderLine;
        $this->normalizer = $normalizer ?? new IranPhoneNormalizer();
        $this->httpClient = $httpClient ?? self::defaultHttpClient();
    }

    public function getLastProviderMessageId(): ?string { return $this->lastProviderMessageId; }

    public function send(Sms $sms): void
    {
        foreach ($sms->getToNumberList() as $number) $this->sendDirect($number, $sms->getBody());
    }

    public function sendDirect(string $phone, string $message): bool
    {
        if (!$this->enabled) throw new RuntimeException('Kavenegar SMS dispatch failed: integration is disabled.');
        if ($this->apiKey === '') throw new RuntimeException('Kavenegar SMS dispatch failed: API key is not configured.');
        $localPhone = $this->normalizer->toLocalMobile($phone);
        if ($localPhone === null) throw new RuntimeException('Invalid Iranian mobile phone number.');
        $message = trim($message);
        if ($message === '') throw new RuntimeException('SMS message must not be empty.');
        $this->lastProviderMessageId = null;
        $url = "https://api.kavenegar.com/v1/{$this->apiKey}/sms/send.json";
        $params = ['receptor' => $localPhone, 'message' => $message];
        if ($this->senderLine !== null && trim($this->senderLine) !== '') $params['sender'] = $this->senderLine;
        try {
            $response = ($this->httpClient)($url, $params);
            $status = $response['status'] ?? 0;
            if ($status !== 200) throw new RuntimeException("HTTP {$status}");
            $decoded = json_decode((string) ($response['body'] ?? ''), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($decoded) || !isset($decoded['return']['status']) || (int) $decoded['return']['status'] !== 200) {
                $providerStatus = is_array($decoded) ? ($decoded['return']['status'] ?? 'unknown') : 'unknown';
                throw new RuntimeException("provider code {$providerStatus}");
            }
            $providerId = $decoded['entries'][0]['messageid'] ?? null;
            if (is_string($providerId) || is_int($providerId)) $this->lastProviderMessageId = (string) $providerId;
            return true;
        } catch (\Throwable $e) {
            $detail = str_replace($this->apiKey, '***', $e->getMessage());
            throw new RuntimeException('Kavenegar SMS dispatch failed: ' . $detail);
        }
    }

    private static function defaultHttpClient(): Closure
    {
        return static function (string $url, array $params): array {
            $ch = curl_init($url);
            if ($ch === false) throw new RuntimeException('Unable to initialize secure cURL request.');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query($params),
                CURLOPT_TIMEOUT => 10,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            ]);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $error = curl_error($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($errno !== 0) throw new RuntimeException("cURL error ({$errno}): {$error}");
            return ['status' => $status, 'body' => is_string($body) ? $body : ''];
        };
    }
}
