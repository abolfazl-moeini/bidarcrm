<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Domain;

use DateTimeImmutable;

class RottenDealCalculator
{
    public function calculate(
        ?string $stage,
        ?int $stageRottenDays,
        DateTimeImmutable $lastActivityAt,
        DateTimeImmutable $now
    ): RottenResult {
        if ($lastActivityAt >= $now) {
            return new RottenResult(false, 0);
        }

        $diff = $now->diff($lastActivityAt);
        $days = (int) $diff->days;

        if ($stage === 'Closed Won' || $stage === 'Closed Lost') {
            return new RottenResult(false, $days);
        }

        if ($stageRottenDays === null || $stageRottenDays <= 0) {
            return new RottenResult(false, $days);
        }

        $isRotten = $days > $stageRottenDays;

        return new RottenResult($isRotten, $days);
    }
}
