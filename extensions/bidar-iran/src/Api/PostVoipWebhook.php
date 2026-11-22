<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Api;

use Espo\Modules\BidarIran\Services\VoipLookupService;

class PostVoipWebhook
{
    private VoipLookupService $service;

    public function __construct(?VoipLookupService $service = null)
    {
        $this->service = $service ?? new VoipLookupService('');
    }

    public function getService(): VoipLookupService
    {
        return $this->service;
    }
}
