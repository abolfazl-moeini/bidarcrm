<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarSales\Domain\RottenDealCalculator;

class RottenDealCalculatorTest extends TestCase
{
    private RottenDealCalculator $calculator;

    protected function setUp(): void
    {
        $this->calculator = new RottenDealCalculator();
    }

    public function testDealIsRottenWhenLastActivityExceedsStageThreshold(): void
    {
        $now = new DateTimeImmutable('2026-11-22 12:00:00');
        // lastActivityAt is 6 days ago, stage threshold is 5 days
        $lastActivityAt = new DateTimeImmutable('2026-11-16 12:00:00');
        $stageRottenDays = 5;
        $stageProbability = 'Proposal/Price Quote';

        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

        $this->assertTrue($result->isRotten());
        $this->assertSame(6, $result->daysSinceLastActivity());
    }

    public function testDealIsNotRottenWhenActivityIsRecent(): void
    {
        $now = new DateTimeImmutable('2026-11-22 12:00:00');
        // lastActivityAt is 2 days ago, threshold is 5 days
        $lastActivityAt = new DateTimeImmutable('2026-11-20 12:00:00');
        $stageRottenDays = 5;
        $stageProbability = 'Negotiation/Review';

        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

        $this->assertFalse($result->isRotten());
        $this->assertSame(2, $result->daysSinceLastActivity());
    }

    public function testClosedWonDealIsNeverRottenEvenAfterLongTime(): void
    {
        $now = new DateTimeImmutable('2026-11-22 12:00:00');
        $lastActivityAt = new DateTimeImmutable('2026-01-01 12:00:00');
        $stageRottenDays = 5;
        $stageProbability = 'Closed Won';

        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

        $this->assertFalse($result->isRotten(), 'Closed Won deal must never be marked rotten');
        $this->assertSame(325, $result->daysSinceLastActivity());
    }

    public function testClosedLostDealIsNeverRotten(): void
    {
        $now = new DateTimeImmutable('2026-11-22 12:00:00');
        $lastActivityAt = new DateTimeImmutable('2026-01-01 12:00:00');
        $stageRottenDays = 5;
        $stageProbability = 'Closed Lost';

        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

        $this->assertFalse($result->isRotten(), 'Closed Lost deal must never be marked rotten');
    }

    public function testStageWithNullRottenDaysNeverRots(): void
    {
        $now = new DateTimeImmutable('2026-11-22 12:00:00');
        $lastActivityAt = new DateTimeImmutable('2026-01-01 12:00:00');
        $stageRottenDays = null;
        $stageProbability = 'Prospecting';

        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

        $this->assertFalse($result->isRotten());
    }
}
