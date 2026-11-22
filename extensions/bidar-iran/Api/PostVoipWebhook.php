<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\BidarIran\Services\VoipLookupService;
use Espo\ORM\EntityManager;

class PostVoipWebhook implements Action
{
    private ?VoipLookupService $service;
    private ?EntityManager $entityManager;

    public function __construct(
        ?VoipLookupService $service = null,
        ?EntityManager $entityManager = null
    ) {
        $this->service = $service;
        $this->entityManager = $entityManager;
    }

    public function getService(): ?VoipLookupService
    {
        return $this->service;
    }

    public function process(Request $request): Response
    {
        $service = $this->service;

        if ($service === null) {
            $secret = '';
            if ($this->entityManager !== null) {
                $integration = $this->entityManager->getEntityById('Integration', 'BidarVoip');
                if ($integration !== null) {
                    $secret = (string) ($integration->get('webhookSecret') ?? '');
                }
            }
            $service = new VoipLookupService($secret);
        }

        $receivedSecret = $request->getHeader('X-Bidar-Voip-Secret')
            ?? $request->getHeader('X-Voip-Token');

        if (!$service->authenticate($receivedSecret)) {
            throw new Forbidden('Invalid or missing VoIP webhook secret.');
        }

        $body = (array) $request->getParsedBody();
        $rawPhone = (string) ($body['phone'] ?? $body['caller'] ?? $body['caller_id'] ?? $request->getQueryParam('phone') ?? '');

        $contacts = [];
        $deals = [];

        if ($this->entityManager !== null) {
            $contactCollection = $this->entityManager->getRDBRepository('Contact')->find();
            foreach ($contactCollection as $c) {
                $contacts[] = [
                    'id' => $c->getId(),
                    'name' => $c->get('name'),
                    'phone' => $c->get('phoneNumber') ?? $c->get('phone'),
                    'accountId' => $c->get('accountId'),
                    'accountName' => $c->get('accountName'),
                ];
            }

            $dealCollection = $this->entityManager->getRDBRepository('Opportunity')
                ->where([
                    'stageProbability!=' => ['Closed Won', 'Closed Lost'],
                ])
                ->find();
            foreach ($dealCollection as $d) {
                $deals[] = [
                    'id' => $d->getId(),
                    'name' => $d->get('name'),
                    'amount' => $d->get('amountConverted') ?? $d->get('amount') ?? 0,
                    'stage' => $d->get('stage'),
                    'contactId' => $d->get('contactId'),
                ];
            }
        }

        $result = $service->lookup($rawPhone, $contacts, $deals);

        return ResponseComposer::json($result);
    }
}
