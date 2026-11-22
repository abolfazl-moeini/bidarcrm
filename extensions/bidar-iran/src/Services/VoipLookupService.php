<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Services;

use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;

class VoipLookupService
{
    private IranPhoneNormalizer $normalizer;

    public function __construct(
        private string $webhookSecret,
        ?IranPhoneNormalizer $normalizer = null
    ) {
        $this->normalizer = $normalizer ?? new IranPhoneNormalizer();
    }

    public function authenticate(?string $receivedSecret): bool
    {
        if ($receivedSecret === null || $receivedSecret === '') {
            return false;
        }

        return hash_equals($this->webhookSecret, $receivedSecret);
    }

    /**
     * @param list<array<string, mixed>> $contacts
     * @param list<array<string, mixed>> $deals
     * @return array<string, mixed>
     */
    public function lookup(string $rawPhone, array $contacts, array $deals): array
    {
        $normalized = $this->normalizer->toE164($rawPhone);
        $local = $this->normalizer->toLocal($rawPhone);

        $matchedContact = null;
        foreach ($contacts as $contact) {
            $cPhone = (string) ($contact['phone'] ?? '');
            $cNormalized = $this->normalizer->toE164($cPhone);
            if ($cNormalized !== null && ($cNormalized === $normalized || $this->normalizer->toLocal($cPhone) === $local)) {
                $matchedContact = $contact;
                break;
            }
        }

        if ($matchedContact === null) {
            return [
                'found' => false,
                'normalizedPhone' => $normalized ?? $rawPhone,
                'contact' => null,
                'deals' => [],
            ];
        }

        $matchedDeals = [];
        $contactId = $matchedContact['id'] ?? '';
        foreach ($deals as $deal) {
            if (($deal['contactId'] ?? '') === $contactId) {
                $matchedDeals[] = $deal;
            }
        }

        return [
            'found' => true,
            'normalizedPhone' => $normalized,
            'contact' => $matchedContact,
            'deals' => $matchedDeals,
        ];
    }
}
