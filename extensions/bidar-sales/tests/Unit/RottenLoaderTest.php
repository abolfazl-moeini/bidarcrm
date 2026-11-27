<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\FieldProcessing\Loader\Params;
use Espo\Modules\BidarSales\FieldProcessing\Opportunity\RottenLoader;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RottenLoaderTest extends TestCase
{
    public function testMalformedActivityDateFailsClosed(): void
    {
        $loader = new RottenLoader();

        $result = $loader->processData([
            'lastActivityAt' => 'not-a-date',
            'stage' => 'Prospecting',
            'stageRottenDays' => 3,
        ]);

        $this->assertFalse($result['isRotten']);
        $this->assertNull($result['daysSinceLastActivity']);
    }

    public function testFutureActivityDateIsNotRottenAndHasZeroDays(): void
    {
        $loader = new RottenLoader();
        $now = new \DateTimeImmutable('2026-11-25 12:00:00');

        $result = $loader->processData([
            'lastActivityAt' => '2026-11-26 12:00:00',
            'stage' => 'Prospecting',
            'stageRottenDays' => 3,
        ], $now);

        $this->assertFalse($result['isRotten']);
        $this->assertSame(0, $result['daysSinceLastActivity']);
    }

    public static function closedMappedStatusProvider(): array
    {
        return [
            'won' => ['Closed Won'],
            'lost' => ['Closed Lost'],
        ];
    }

    #[DataProvider('closedMappedStatusProvider')]
    public function testPipelineMappedClosedStatusPreventsRottenDeal(string $mappedStatus): void
    {
        $now = new \DateTimeImmutable('2026-11-25 12:00:00');
        $lastActivityAt = '2026-11-01 12:00:00';
        $values = [
            'lastActivityAt' => $lastActivityAt,
            'stage' => 'Prospecting',
            'pipelineStageId' => 'pipeline-stage-1',
        ];
        $opportunity = $this->createMock(Entity::class);
        $opportunity->method('has')->willReturnCallback(fn (string $field) => array_key_exists($field, $values));
        $opportunity->method('get')->willReturnCallback(fn (string $field) => $values[$field] ?? null);
        $opportunity->method('set')->willReturnCallback(function ($field, $value) use (&$values, $opportunity) {
            $values[$field] = $value;
            return $opportunity;
        });

        $stage = $this->createMock(Entity::class);
        $stage->method('has')->willReturnCallback(fn (string $field) => in_array($field, ['rottenDays', 'mappedStatus'], true));
        $stage->method('get')->willReturnCallback(fn (string $field) => match ($field) {
            'rottenDays' => null,
            'mappedStatus' => $mappedStatus,
            default => null,
        });

        $em = $this->createMock(EntityManager::class);
        $em->expects($this->once())
            ->method('getEntityById')
            ->with('PipelineStage', 'pipeline-stage-1')
            ->willReturn($stage);

        $loader = new RottenLoader(null, $em);
        $loader->process($opportunity, Params::create());

        $this->assertFalse($values['isRotten']);
        $this->assertGreaterThan(0, $values['daysSinceLastActivity']);
    }
}
