<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarSales\Hooks\Opportunity\InitLastActivity;
use Espo\Modules\BidarSales\Hooks\Common\UpdateOpportunityActivity;
use Espo\Modules\BidarSales\FieldProcessing\Opportunity\RottenLoader;

class ActivityHooksTest extends TestCase
{
    public function testInitLastActivitySetsCurrentTimeIfMissing(): void
    {
        $hook = new InitLastActivity();
        $opportunityData = ['id' => 'opp-1', 'name' => 'معامله تستی'];

        $now = new DateTimeImmutable('2026-11-22 10:00:00');
        $updatedData = $hook->beforeSave($opportunityData, $now);

        $this->assertArrayHasKey('lastActivityAt', $updatedData);
        $this->assertSame('2026-11-22 10:00:00', $updatedData['lastActivityAt']);
    }

    public function testInitLastActivityPreservesExistingLastActivityAt(): void
    {
        $hook = new InitLastActivity();
        $opportunityData = [
            'id' => 'opp-1',
            'lastActivityAt' => '2026-11-20 15:30:00',
        ];

        $now = new DateTimeImmutable('2026-11-22 10:00:00');
        $updatedData = $hook->beforeSave($opportunityData, $now);

        $this->assertSame('2026-11-20 15:30:00', $updatedData['lastActivityAt']);
    }

    public function testUpdateOpportunityActivityHookFiltersTargetParents(): void
    {
        $hook = new UpdateOpportunityActivity();

        $this->assertTrue($hook->shouldUpdateForParent('Opportunity'));
        $this->assertFalse($hook->shouldUpdateForParent('Contact'));
        $this->assertFalse($hook->shouldUpdateForParent('Account'));
    }

    public function testRottenLoaderInjectsComputedFieldsIntoOpportunity(): void
    {
        $loader = new RottenLoader();
        $now = new DateTimeImmutable('2026-11-22 12:00:00');

        $opportunity = [
            'id' => 'opp-100',
            'stage' => 'Proposal',
            'stageProbability' => 'In Progress',
            'stageRottenDays' => 3,
            'lastActivityAt' => '2026-11-18 12:00:00', // 4 days ago
        ];

        $enriched = $loader->process($opportunity, $now);

        $this->assertTrue($enriched['isRotten']);
        $this->assertSame(4, $enriched['daysSinceLastActivity']);
    }
}
