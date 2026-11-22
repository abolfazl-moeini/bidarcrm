<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Sms;

use Closure;
use RuntimeException;
use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;

class KavenegarSender
{
    private IranPhoneNormalizer $normalizer;
    /** @var Closure(string, array<string, mixed>): array{status: int, body: string} */
    private Closure $httpClient;

    /**
     * @param ?Closure(string, array<string, mixed>): array{status: int, body: string} $httpClient
     */
    public function __construct(
        private string $apiKey,
        private ?string $senderLine = null,
        ?Closure $httpClient = null,
        ?IranPhoneNormalizer $normalizer = null
    ) {
        $this->normalizer = $normalizer ?? new IranPhoneNormalizer();
        $this->httpClient = $httpClient ?? self::defaultHttpClient();
    }

    public function send(string $phone, string $message): bool
    {
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
            if (($response['status'] ?? 0) !== 200) {
                $status = $response['status'] ?? 'unknown';
                throw new RuntimeException("Kavenegar SMS dispatch failed with HTTP {$status}");
            }

            return true;
        } catch (\Throwable $e) {
            if (str_contains($e->getMessage(), 'Kavenegar SMS dispatch failed')) {
                throw $e;
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
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            return [
                'status' => $status,
                'body' => is_string($body) ? $body : '',
            ];
        };
    }
}
