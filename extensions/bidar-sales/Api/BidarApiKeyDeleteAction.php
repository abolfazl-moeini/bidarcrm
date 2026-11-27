<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Entities\User;
use Espo\Modules\BidarSales\Services\BidarApiKeyService;
use Espo\ORM\EntityManager;

class BidarApiKeyDeleteAction implements Action
{
    private ?User $user;
    private BidarApiKeyService $service;

    public function __construct(
        ?User $user = null,
        ?BidarApiKeyService $service = null,
        ?EntityManager $entityManager = null
    ) {
        $this->user = $user;
        $this->service = $service ?? new BidarApiKeyService($entityManager);
    }

    public function process(Request $request): Response
    {
        if ($this->user === null) {
            throw new Forbidden('Authentication required.');
        }

        $id = $request->getRouteParam('id');
        if (!$id || !is_string($id)) {
            throw new BadRequest('Key ID is required.');
        }

        $this->service->revokeKey($this->user, $id);

        return ResponseComposer::json(['success' => true]);
    }
}
