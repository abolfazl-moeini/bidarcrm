<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Container;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\BidarIran\Services\VoipLookupService;
use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;
use Espo\ORM\EntityManager;

class PostVoipWebhook implements Action
{
    public function __construct(
        private ?VoipLookupService $service = null,
        private ?EntityManager $entityManager = null,
        private ?Container $container = null
    ) {}

    public function getService(): ?VoipLookupService { return $this->service; }

    public function process(Request $request): Response
    {
        $em = $this->resolveEntityManager();
        $integration = $em?->getEntityById('Integration', 'BidarVoip');
        if ($integration !== null && $integration->get('enabled') === false) {
            throw new Forbidden('VoIP integration is disabled.');
        }
        $secret = (string) ($integration?->get('webhookSecret') ?? '');
        $hmacSecret = (string) ($integration?->get('hmacSecret') ?? '');
        $service = $this->service ?? new VoipLookupService($secret);

        $remoteIp = $request->getServerParam('REMOTE_ADDR');
        $allowedIps = trim((string) ($integration?->get('allowedIps') ?? ''));
        if ($allowedIps !== '') {
            $allowed = preg_split('/[,\s]+/', $allowedIps, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            if (!is_string($remoteIp) || !in_array($remoteIp, $allowed, true)) {
                throw new Forbidden('Webhook IP address is not allowed.');
            }
        }

        $rawBody = $request->getBodyContents() ?? '';
        $timestamp = $request->getHeader('X-Bidar-Voip-Timestamp');
        $signature = $request->getHeader('X-Bidar-Voip-Signature');
        if ($hmacSecret !== '' || $timestamp !== null || $signature !== null) {
            if ($hmacSecret === '' || $timestamp === null || $signature === null || !ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
                throw new Forbidden('Invalid or expired VoIP webhook signature.');
            }
            $expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, $hmacSecret);
            $provided = preg_replace('/^sha256=/i', '', $signature) ?? '';
            if (!hash_equals($expected, $provided)) {
                throw new Forbidden('Invalid or expired VoIP webhook signature.');
            }
        } elseif (!$service->authenticate($request->getHeader('X-Bidar-Voip-Secret') ?? $request->getHeader('X-Voip-Token'))) {
            throw new Forbidden('Invalid or missing VoIP webhook secret.');
        }

        $body = $this->toArray($request->getParsedBody());
        $rawPhone = $body['phone'] ?? $body['caller'] ?? $body['caller_id'] ?? null;
        if (!is_string($rawPhone) || trim($rawPhone) === '' || strlen($rawPhone) > 32) {
            throw new BadRequest('A valid caller phone number is required.');
        }
        $normalizer = new IranPhoneNormalizer();
        $candidates = array_values(array_unique(array_filter([
            $normalizer->toE164($rawPhone), $normalizer->toLocal($rawPhone), trim($rawPhone),
        ], static fn ($v) => is_string($v) && $v !== '')));
        $contacts = [];
        $deals = [];
        if ($em !== null) {
            $repository = $em->getRDBRepository('Contact');
            $query = $this->applyQueryParts(
                $repository,
                ['id', 'name', 'phoneNumber', 'accountId', 'accountName'],
                ['phoneNumber' => $candidates],
                1
            );
            $collection = $query->find();
            $matchedId = null;
            foreach ($collection as $contact) {
                $matchedId = $contact->getId();
                $contacts[] = [
                    'id' => $matchedId,
                    'name' => $contact->get('name'),
                    'phone' => $contact->get('phoneNumber') ?? $rawPhone,
                    'matchedPhone' => $rawPhone,
                    'accountId' => $contact->get('accountId'),
                    'accountName' => $contact->get('accountName'),
                ];
                break;
            }

            if ($matchedId === null && method_exists($em, 'getRDBRepository')) {
                try {
                    $phoneRepository = $em->getRDBRepository('PhoneNumber');
                    $phoneQuery = $this->applyQueryParts($phoneRepository, ['id', 'name'], ['name' => $candidates], 20);
                    $phoneRows = $phoneQuery->find();
                    $phoneMap = [];
                    foreach ($phoneRows as $phoneRow) {
                        $phoneId = $phoneRow->getId();
                        if (is_string($phoneId) && $phoneId !== '') {
                            $phoneMap[$phoneId] = (string) ($phoneRow->get('name') ?? $rawPhone);
                        }
                    }

                    if ($phoneMap !== []) {
                        $entityPhoneRepo = $em->getRDBRepository('EntityPhoneNumber');
                        $linkQuery = $this->applyQueryParts(
                            $entityPhoneRepo,
                            ['entityType', 'entityId', 'phoneNumberId'],
                            ['phoneNumberId' => array_keys($phoneMap), 'entityType' => 'Contact'],
                            20
                        );
                        foreach ($linkQuery->find() as $linkRow) {
                            if ($linkRow->get('entityType') !== 'Contact') {
                                continue;
                            }
                            $contactId = (string) ($linkRow->get('entityId') ?? '');
                            if ($contactId === '') {
                                continue;
                            }
                            $contact = $em->getEntityById('Contact', $contactId);
                            if ($contact === null) {
                                continue;
                            }
                            $matchedId = $contact->getId();
                            $matchedNum = $phoneMap[(string) ($linkRow->get('phoneNumberId') ?? '')] ?? $rawPhone;
                            $contacts[] = [
                                'id' => $matchedId,
                                'name' => $contact->get('name'),
                                'phone' => $contact->get('phoneNumber') ?? $matchedNum,
                                'matchedPhone' => $matchedNum,
                                'accountId' => $contact->get('accountId'),
                                'accountName' => $contact->get('accountName'),
                            ];
                            break;
                        }
                    }
                } catch (\Throwable) {
                    // Secondary phone storage is optional across EspoCRM versions.
                }
            }
            if ($matchedId !== null) {
                $opportunityRepository = $em->getRDBRepository('Opportunity');
                $oppQuery = $this->applyQueryParts(
                    $opportunityRepository,
                    ['id', 'name', 'amount', 'amountConverted', 'stage', 'contactId'],
                    ['contactId' => $matchedId, 'stage!=' => ['Closed Won', 'Closed Lost']],
                    20
                );
                foreach ($oppQuery->find() as $deal) {
                    $deals[] = ['id' => $deal->getId(), 'name' => $deal->get('name'), 'amount' => $deal->get('amountConverted') ?? $deal->get('amount') ?? 0, 'stage' => $deal->get('stage'), 'contactId' => $deal->get('contactId')];
                }
            }
        }
        return ResponseComposer::json($service->lookup($rawPhone, $contacts, $deals));
    }

    /**
     * @param list<string> $select
     * @param array<string, mixed> $where
     */
    private function applyQueryParts(object $repository, array $select, array $where, int $limit): object
    {
        $query = $repository;
        if (method_exists($query, 'select')) {
            try {
                $next = $query->select($select);
                if (is_object($next)) {
                    $query = $next;
                }
            } catch (\TypeError) {
            }
        }
        if (method_exists($query, 'where')) {
            try {
                $next = $query->where($where);
                if (is_object($next)) {
                    $query = $next;
                }
            } catch (\TypeError) {
            }
        }
        if (method_exists($query, 'limit')) {
            try {
                $next = $query->limit(0, $limit);
                if (is_object($next)) {
                    $query = $next;
                }
            } catch (\TypeError) {
            }
        }

        return $query;
    }

    private function resolveEntityManager(): ?EntityManager
    {
        if ($this->entityManager !== null) return $this->entityManager;
        if ($this->container !== null && $this->container->has('entityManager')) {
            return $this->container->get('entityManager');
        }
        return null;
    }

    /** @return array<string, mixed> */
    private function toArray(mixed $value): array
    {
        if (is_array($value)) return array_map(fn ($item) => $item instanceof \stdClass ? $this->toArray($item) : $item, $value);
        if ($value instanceof \stdClass) return $this->toArray(get_object_vars($value));
        return [];
    }
}
