<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Domain;

class RottenResult
{
    public function __construct(
        private bool $isRotten,
        private int $daysSinceLastActivity
    ) {}

    public function isRotten(): bool
    {
        return $this->isRotten;
    }

    public function daysSinceLastActivity(): int
    {
        return $this->daysSinceLastActivity;
    }
}
