<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Hooks\Opportunity;

use DateTimeImmutable;

class InitLastActivity
{
    public function beforeSave(array $data, ?DateTimeImmutable $now = null): array
    {
        if (empty($data['lastActivityAt'])) {
            $currentTime = $now ?? new DateTimeImmutable('now');
            $data['lastActivityAt'] = $currentTime->format('Y-m-d H:i:s');
        }

        return $data;
    }
}
