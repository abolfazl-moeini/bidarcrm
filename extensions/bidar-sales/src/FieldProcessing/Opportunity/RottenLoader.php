<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\FieldProcessing\Opportunity;

use DateTimeImmutable;
use Espo\Modules\BidarSales\Domain\RottenDealCalculator;

class RottenLoader
{
    private RottenDealCalculator $calculator;

    public function __construct(?RottenDealCalculator $calculator = null)
    {
        $this->calculator = $calculator ?? new RottenDealCalculator();
    }

    public function process(array $opportunity, ?DateTimeImmutable $now = null): array
    {
        $now = $now ?? new DateTimeImmutable('now');

        $lastActivityStr = $opportunity['lastActivityAt'] ?? null;
        if ($lastActivityStr === null) {
            $opportunity['isRotten'] = false;
            $opportunity['daysSinceLastActivity'] = 0;
            return $opportunity;
        }

        $lastActivityAt = new DateTimeImmutable($lastActivityStr);
        $stageProbability = $opportunity['stageProbability'] ?? null;
        $stageRottenDays = isset($opportunity['stageRottenDays']) ? (int) $opportunity['stageRottenDays'] : null;

        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

        $opportunity['isRotten'] = $result->isRotten();
        $opportunity['daysSinceLastActivity'] = $result->daysSinceLastActivity();

        return $opportunity;
    }
}
