<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Domain;

use DateTimeImmutable;

class RottenDealCalculator
{
    public function calculate(
        ?string $stageProbability,
        ?int $stageRottenDays,
        DateTimeImmutable $lastActivityAt,
        DateTimeImmutable $now
    ): RottenResult {
        $diff = $now->diff($lastActivityAt);
        $days = (int) $diff->days;

        if ($stageProbability === 'Closed Won' || $stageProbability === 'Closed Lost') {
            return new RottenResult(false, $days);
        }

        if ($stageRottenDays === null || $stageRottenDays <= 0) {
            return new RottenResult(false, $days);
        }

        $isRotten = $days > $stageRottenDays;

        return new RottenResult($isRotten, $days);
    }
}
