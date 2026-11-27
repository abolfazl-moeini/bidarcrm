<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use DateTimeImmutable;
use Espo\Core\FieldProcessing\Loader;
use Espo\Core\FieldProcessing\Loader\Params;
use Espo\Core\Hook\Hook\AfterSave;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\Modules\BidarSales\FieldProcessing\Opportunity\RottenLoader;
use Espo\Modules\BidarSales\Hooks\Common\UpdateOpportunityActivity;
use Espo\Modules\BidarSales\Hooks\Opportunity\InitLastActivity;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\SaveOptions;
use PHPUnit\Framework\TestCase;

class ActivityHooksTest extends TestCase
{
    public function testInitLastActivityImplementsBeforeSaveInterface(): void
    {
        $hook = new InitLastActivity();
        $this->assertInstanceOf(BeforeSave::class, $hook);
    }

    public function testInitLastActivitySetsCurrentTimeIfMissingViaEntity(): void
    {
        $hook = new InitLastActivity();

        $entity = $this->createMock(Entity::class);
        $entity->method('has')->with('lastActivityAt')->willReturn(false);
        $entity->expects($this->once())
            ->method('set')
            ->with('lastActivityAt', $this->callback(function (string $val) {
                return !empty($val);
            }))
            ->willReturnSelf();

        $saveOptions = $this->createMock(SaveOptions::class);
        $hook->beforeSave($entity, $saveOptions);
    }

    public function testInitLastActivitySetsCurrentTimeIfMissingViaHelper(): void
    {
        $hook = new InitLastActivity();
        $opportunityData = ['id' => 'opp-1', 'name' => 'معامله تستی'];

        $now = new DateTimeImmutable('2026-11-22 10:00:00');
        $updatedData = $hook->applyBeforeSaveData($opportunityData, $now);

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
        $updatedData = $hook->applyBeforeSaveData($opportunityData, $now);

        $this->assertSame('2026-11-20 15:30:00', $updatedData['lastActivityAt']);
    }

    public function testUpdateOpportunityActivityHookImplementsAfterSaveInterface(): void
    {
        $hook = new UpdateOpportunityActivity();
        $this->assertInstanceOf(AfterSave::class, $hook);
    }

    public function testUpdateOpportunityActivityHookFiltersTargetParentsAndEntityTypes(): void
    {
        $hook = new UpdateOpportunityActivity();

        $this->assertTrue($hook->shouldUpdateForParent('Opportunity'));
        $this->assertFalse($hook->shouldUpdateForParent('Contact'));
        $this->assertFalse($hook->shouldUpdateForParent('Account'));

        $this->assertTrue($hook->isTargetEntityType('Note'));
        $this->assertTrue($hook->isTargetEntityType('Call'));
        $this->assertTrue($hook->isTargetEntityType('Meeting'));
        $this->assertTrue($hook->isTargetEntityType('Task'));
        $this->assertFalse($hook->isTargetEntityType('Opportunity'));
        $this->assertFalse($hook->isTargetEntityType('User'));
    }

    public function testRottenLoaderImplementsLoaderInterface(): void
    {
        $loader = new RottenLoader();
        $this->assertInstanceOf(Loader::class, $loader);
    }

    public function testRottenLoaderInjectsComputedFieldsIntoOpportunityViaHelper(): void
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

        $enriched = $loader->processData($opportunity, $now);

        $this->assertTrue($enriched['isRotten']);
        $this->assertSame(4, $enriched['daysSinceLastActivity']);
    }

    public function testRottenLoaderInjectsComputedFieldsIntoEntity(): void
    {
        $loader = new RottenLoader();

        $entity = $this->createMock(Entity::class);
        $entity->method('has')->willReturnCallback(function (string $name) {
            return in_array($name, ['lastActivityAt', 'stageProbability', 'stageRottenDays']);
        });
        $entity->method('get')->willReturnCallback(function (string $name) {
            return match ($name) {
                'lastActivityAt' => (new DateTimeImmutable('-4 days'))->format('Y-m-d H:i:s'),
                'stageProbability' => 'In Progress',
                'stageRottenDays' => 3,
                default => null,
            };
        });

        $entity->expects($this->exactly(2))
            ->method('set')
            ->willReturnCallback(function (string $name, $value) use ($entity) {
                if ($name === 'isRotten') {
                    $this->assertTrue($value);
                } elseif ($name === 'daysSinceLastActivity') {
                    $this->assertGreaterThanOrEqual(3, $value);
                }
                return $entity;
            });

        $params = $this->createMock(Params::class);
        $loader->process($entity, $params);
    }

    public function testRottenLoaderNeverMarksClosedWonOrClosedLostAsRotten(): void
    {
        $loader = new RottenLoader();
        $now = new DateTimeImmutable('2026-11-22 12:00:00');

        // Deal with stage 'Closed Won' and very old lastActivityAt (100 days ago)
        $wonDeal = [
            'id' => 'opp-won',
            'stage' => 'Closed Won',
            'stageRottenDays' => 3,
            'lastActivityAt' => '2026-08-14 12:00:00',
        ];
        $enrichedWon = $loader->processData($wonDeal, $now);
        $this->assertFalse($enrichedWon['isRotten'], 'Closed Won deal must never be marked rotten');
        $this->assertSame(100, $enrichedWon['daysSinceLastActivity']);

        // Deal with stage 'Closed Lost' and very old lastActivityAt (50 days ago)
        $lostDeal = [
            'id' => 'opp-lost',
            'stage' => 'Closed Lost',
            'stageRottenDays' => 3,
            'lastActivityAt' => '2026-10-03 12:00:00',
        ];
        $enrichedLost = $loader->processData($lostDeal, $now);
        $this->assertFalse($enrichedLost['isRotten'], 'Closed Lost deal must never be marked rotten');
        $this->assertSame(50, $enrichedLost['daysSinceLastActivity']);

        // Entity test: Closed Won entity
        $wonEntity = $this->createMock(Entity::class);
        $wonEntity->method('has')->willReturnCallback(function (string $name) {
            return in_array($name, ['lastActivityAt', 'stage', 'stageRottenDays']);
        });
        $wonEntity->method('get')->willReturnCallback(function (string $name) {
            return match ($name) {
                'lastActivityAt' => '2026-08-14 12:00:00',
                'stage' => 'Closed Won',
                'stageRottenDays' => 3,
                default => null,
            };
        });
        $wonEntity->expects($this->exactly(2))
            ->method('set')
            ->willReturnCallback(function (string $name, $value) use ($wonEntity) {
                if ($name === 'isRotten') {
                    $this->assertFalse($value, 'Entity isRotten must be false for Closed Won');
                } elseif ($name === 'daysSinceLastActivity') {
                    $this->assertGreaterThan(30, $value);
                }
                return $wonEntity;
            });
        $params = $this->createMock(Params::class);
        $loader->process($wonEntity, $params);
    }

    public function testOpportunityMetadataRegistersRottenLoader(): void
    {
        $recordDefsFile = dirname(__DIR__, 2) . '/Resources/metadata/recordDefs/Opportunity.json';
        $this->assertFileExists($recordDefsFile, 'recordDefs/Opportunity.json must exist');

        $content = file_get_contents($recordDefsFile);
        $this->assertIsString($content);

        $data = json_decode($content, true);
        $this->assertIsArray($data);
        $this->assertArrayHasKey('readLoaderClassNameList', $data);
        $this->assertContains('__APPEND__', $data['readLoaderClassNameList']);
        $this->assertContains(
            'Espo\\Modules\\BidarSales\\FieldProcessing\\Opportunity\\RottenLoader',
            $data['readLoaderClassNameList']
        );
    }

    public function testRottenLoaderHandlesFutureAndMalformedDatesAndClosedMappedStatus(): void
    {
        $loader = new RottenLoader();
        $now = new DateTimeImmutable('2026-11-22 12:00:00');

        $futureDeal = [
            'id' => 'opp-future',
            'stage' => 'Negotiation',
            'stageRottenDays' => 5,
            'lastActivityAt' => '2026-12-02 12:00:00',
        ];
        $enrichedFuture = $loader->processData($futureDeal, $now);
        $this->assertFalse($enrichedFuture['isRotten']);
        $this->assertSame(0, $enrichedFuture['daysSinceLastActivity']);

        $badDateDeal = [
            'id' => 'opp-bad-date',
            'stage' => 'Negotiation',
            'stageRottenDays' => 5,
            'lastActivityAt' => 'not-a-valid-date',
        ];
        $enrichedBad = $loader->processData($badDateDeal, $now);
        $this->assertFalse($enrichedBad['isRotten']);
        $this->assertNull($enrichedBad['daysSinceLastActivity']);

        $closedMappedDeal = [
            'id' => 'opp-closed-mapped',
            'stage' => 'فروش موفق',
            'stageMappedStatus' => 'Closed Won',
            'stageRottenDays' => 5,
            'lastActivityAt' => '2026-01-01 12:00:00',
        ];
        $enrichedClosed = $loader->processData($closedMappedDeal, $now);
        $this->assertFalse($enrichedClosed['isRotten']);
    }
}
