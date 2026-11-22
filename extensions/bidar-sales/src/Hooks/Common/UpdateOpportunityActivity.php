<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Hooks\Common;

use DateTimeImmutable;

class UpdateOpportunityActivity
{
    public function shouldUpdateForParent(?string $parentType): bool
    {
        return $parentType === 'Opportunity';
    }

    public function updateOpportunityLastActivity(string $opportunityId, ?DateTimeImmutable $now = null): array
    {
        $currentTime = $now ?? new DateTimeImmutable('now');

        return [
            'id' => $opportunityId,
            'lastActivityAt' => $currentTime->format('Y-m-d H:i:s'),
        ];
    }
}
