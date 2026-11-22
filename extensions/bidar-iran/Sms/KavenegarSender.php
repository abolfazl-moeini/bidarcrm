<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Sms;

use Closure;
use RuntimeException;
use Espo\Core\Sms\Sender;
use Espo\Core\Sms\Sms;
use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;
use Espo\ORM\EntityManager;

class KavenegarSender implements Sender
{
    private string $apiKey;
    private ?string $senderLine;
    private IranPhoneNormalizer $normalizer;
    /** @var Closure(string, array<string, mixed>): array{status: int, body: string} */
    private Closure $httpClient;

    /**
     * @param ?Closure(string, array<string, mixed>): array{status: int, body: string} $httpClient
     */
    public function __construct(
        ?string $apiKey = null,
        ?string $senderLine = null,
        ?Closure $httpClient = null,
        ?IranPhoneNormalizer $normalizer = null,
        ?EntityManager $entityManager = null
    ) {
        if (($apiKey === null || $apiKey === '') && $entityManager !== null) {
            $integration = $entityManager->getEntityById('Integration', 'Kavenegar');
            if ($integration !== null) {
                $apiKey = (string) ($integration->get('apiKey') ?? '');
                $senderLine = $senderLine ?? ($integration->has('senderLine') ? (string) $integration->get('senderLine') : null);
            }
        }

        $this->apiKey = $apiKey ?? '';
        $this->senderLine = $senderLine;
        $this->normalizer = $normalizer ?? new IranPhoneNormalizer();
        $this->httpClient = $httpClient ?? self::defaultHttpClient();
    }

    public function send(Sms $sms): void
    {
        $numbers = $sms->getToNumberList();
        $body = $sms->getBody();

        if (empty($numbers)) {
            return;
        }

        foreach ($numbers as $number) {
            $this->sendDirect($number, $body);
        }
    }

    public function sendDirect(string $phone, string $message): bool
    {
        if ($this->apiKey === '') {
            throw new RuntimeException('Kavenegar SMS dispatch failed: API key is not configured.');
        }

        $localPhone = $this->normalizer->toLocal($phone);
        if ($localPhone === null) {
            throw new RuntimeException("Invalid Iranian phone number: {$phone}");
        }

        $url = "https://api.kavenegar.com/v1/{$this->apiKey}/sms/send.json";
        $params = [
            'receptor' => $localPhone,
            'message' => $message,
            'sender' => $this->senderLine ?? '',
        ];

        try {
            $response = ($this->httpClient)($url, $params);
            $statusCode = $response['status'] ?? 0;
            if ($statusCode !== 200) {
                throw new RuntimeException("Kavenegar SMS dispatch failed with HTTP {$statusCode}");
            }

            $rawBody = (string) ($response['body'] ?? '');
            if ($rawBody !== '') {
                $decoded = json_decode($rawBody, true);
                if (is_array($decoded) && isset($decoded['return']['status'])) {
                    $returnStatus = (int) $decoded['return']['status'];
                    if ($returnStatus !== 200) {
                        $msg = (string) ($decoded['return']['message'] ?? "Status {$returnStatus}");
                        throw new RuntimeException("Kavenegar SMS dispatch failed with API code {$returnStatus}: {$msg}");
                    }
                }
            }

            return true;
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            if ($this->apiKey !== '') {
                $msg = str_replace($this->apiKey, '***', $msg);
            }
            if (str_contains($msg, 'Kavenegar SMS dispatch failed')) {
                throw new RuntimeException($msg, (int) $e->getCode(), $e);
            }
            throw new RuntimeException('Kavenegar SMS dispatch failed: connection error', 0, $e);
        }
    }

    private static function defaultHttpClient(): Closure
    {
        return function (string $url, array $params): array {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $error = curl_error($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($errno !== 0) {
                throw new RuntimeException("cURL error ({$errno}): {$error}");
            }

            return [
                'status' => $status,
                'body' => is_string($body) ? $body : '',
            ];
        };
    }
}
