<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Modules\BidarSales\Hooks\Opportunity\PipelineStageSync;
use PHPUnit\Framework\TestCase;

class PipelineStageSyncTest extends TestCase
{
    private array $sampleStages = [
        [
            'id' => 'stage-1',
            'name' => 'تماس اولیه',
            'pipelineId' => 'pipe-1',
            'mappedStatus' => 'Prospecting',
        ],
        [
            'id' => 'stage-2',
            'name' => 'پیگیری و مذاکره',
            'pipelineId' => 'pipe-1',
            'mappedStatus' => 'Qualification',
        ],
        [
            'id' => 'stage-3',
            'name' => 'ارسال پیش‌فاکتور',
            'pipelineId' => 'pipe-1',
            'mappedStatus' => 'Proposal',
        ],
        [
            'id' => 'stage-6',
            'name' => 'ناموفق (از دست رفته)',
            'pipelineId' => 'pipe-1',
            'mappedStatus' => 'Closed Lost',
        ],
    ];

    public function testSyncFromPipelineStageId(): void
    {
        $input = [
            'name' => 'معامله تستی',
            'pipelineStageId' => 'stage-3',
        ];

        $result = PipelineStageSync::applySyncData($input, $this->sampleStages);

        $this->assertSame('Proposal', $result['stage']);
        $this->assertSame('ارسال پیش‌فاکتور', $result['pipelineStageName']);
        $this->assertSame('pipe-1', $result['pipelineId']);
    }

    public function testSyncFromStageNameOrMappedStatus(): void
    {
        $input = [
            'name' => 'معامله تستی ۲',
            'stage' => 'Qualification',
        ];

        $result = PipelineStageSync::applySyncData($input, $this->sampleStages);

        $this->assertSame('stage-2', $result['pipelineStageId']);
        $this->assertSame('پیگیری و مذاکره', $result['pipelineStageName']);
        $this->assertSame('pipe-1', $result['pipelineId']);
    }

    public function testSyncFromPersianStageName(): void
    {
        $input = [
            'name' => 'معامله تستی ۳',
            'stage' => 'ناموفق (از دست رفته)',
        ];

        $result = PipelineStageSync::applySyncData($input, $this->sampleStages);

        $this->assertSame('stage-6', $result['pipelineStageId']);
        $this->assertSame('ناموفق (از دست رفته)', $result['pipelineStageName']);
        $this->assertSame('pipe-1', $result['pipelineId']);
    }

    public function testBeforeSavePreservesDirectStageUpdateWhenPipelineStageIdUnchanged(): void
    {
        $stage1 = $this->createMock(\Espo\ORM\Entity::class);
        $stage1->method('getId')->willReturn('stage-1');
        $stage1->method('get')->willReturnCallback(fn (string $k) => match ($k) {
            'name' => 'تماس اولیه',
            'pipelineId' => 'pipe-1',
            'mappedStatus' => 'Prospecting',
            default => null,
        });

        $stageWon = $this->createMock(\Espo\ORM\Entity::class);
        $stageWon->method('getId')->willReturn('stage-won');
        $stageWon->method('get')->willReturnCallback(fn (string $k) => match ($k) {
            'name' => 'موفق',
            'pipelineId' => 'pipe-1',
            'mappedStatus' => 'Closed Won',
            default => null,
        });

        $builder = $this->createMock(\Espo\ORM\Repository\RDBSelectBuilder::class);
        $builder->method('find')->willReturn(new \Espo\ORM\EntityCollection([$stage1, $stageWon]));

        $stageRepo = $this->createMock(\Espo\ORM\Repository\RDBRepository::class);
        $stageRepo->method('where')->with(['pipelineId' => 'pipe-1'])->willReturn($builder);

        $em = $this->createMock(\Espo\ORM\EntityManager::class);
        $em->method('getRDBRepository')->with('PipelineStage')->willReturn($stageRepo);

        $values = [
            'pipelineId' => 'pipe-1',
            'pipelineStageId' => 'stage-1',
            'stage' => 'Closed Won',
        ];
        $opp = $this->createMock(\Espo\ORM\Entity::class);
        $opp->method('isNew')->willReturn(false);
        $opp->method('isAttributeChanged')->willReturnCallback(fn (string $f) => $f === 'stage');
        $opp->method('get')->willReturnCallback(fn (string $f) => $values[$f] ?? null);
        $opp->method('set')->willReturnCallback(function ($k, $v = null) use (&$values, $opp) {
            $values[$k] = $v;
            return $opp;
        });

        $hook = new PipelineStageSync($em);
        $hook->beforeSave($opp, $this->createMock(\Espo\ORM\Repository\Option\SaveOptions::class));

        $this->assertSame('Closed Won', $values['stage']);
        $this->assertSame('stage-won', $values['pipelineStageId']);
    }

    public function testUnrelatedUpdateDoesNotResynchronizeUnchangedPipelineStage(): void
    {
        $values = [
            'pipelineId' => 'pipe-1',
            'pipelineStageId' => 'stage-1',
            'pipelineStageName' => 'مرحله قبلی',
            'stage' => 'Prospecting',
            'description' => 'ویرایش توضیحات',
        ];
        $opp = $this->createMock(\Espo\ORM\Entity::class);
        $opp->method('isNew')->willReturn(false);
        $opp->method('isAttributeChanged')->willReturnCallback(fn (string $field) => $field === 'description');
        $opp->method('get')->willReturnCallback(fn (string $field) => $values[$field] ?? null);
        $opp->expects($this->never())->method('set');

        $em = $this->createMock(\Espo\ORM\EntityManager::class);
        $em->expects($this->never())->method('getEntityById');
        $em->expects($this->never())->method('getRDBRepository');

        $hook = new PipelineStageSync($em);
        $hook->beforeSave($opp, $this->createMock(\Espo\ORM\Repository\Option\SaveOptions::class));

        $this->assertSame('stage-1', $values['pipelineStageId']);
        $this->assertSame('Prospecting', $values['stage']);
    }

    public function testUnrelatedUpdateDoesNotResolveDirectStageWithoutPipelineStageId(): void
    {
        $values = [
            'pipelineId' => 'pipe-1',
            'stage' => 'Prospecting',
            'description' => 'ویرایش توضیحات',
        ];
        $opp = $this->createMock(\Espo\ORM\Entity::class);
        $opp->method('isNew')->willReturn(false);
        $opp->method('isAttributeChanged')->willReturnCallback(fn (string $field) => $field === 'description');
        $opp->method('get')->willReturnCallback(fn (string $field) => $values[$field] ?? null);
        $opp->expects($this->never())->method('set');

        $em = $this->createMock(\Espo\ORM\EntityManager::class);
        $em->expects($this->never())->method('getEntityById');
        $em->expects($this->never())->method('getRDBRepository');

        $hook = new PipelineStageSync($em);
        $hook->beforeSave($opp, $this->createMock(\Espo\ORM\Repository\Option\SaveOptions::class));

        $this->assertArrayNotHasKey('pipelineStageId', $values);
        $this->assertSame('Prospecting', $values['stage']);
    }

    public function testBeforeSaveDoesNotApplyStageFromAnotherPipeline(): void
    {
        $values = [
            'pipelineId' => 'pipe-1',
            'pipelineStageId' => 'pipe2-stage-qualification',
            'stage' => 'Prospecting',
        ];
        $opp = $this->createMock(\Espo\ORM\Entity::class);
        $opp->method('isNew')->willReturn(false);
        $opp->method('isAttributeChanged')->willReturnCallback(fn (string $field) => $field === 'pipelineStageId');
        $opp->method('get')->willReturnCallback(fn (string $field) => $values[$field] ?? null);
        $opp->expects($this->never())->method('set');

        $stage = $this->createMock(\Espo\ORM\Entity::class);
        $stage->method('get')->willReturnCallback(fn (string $field) => match ($field) {
            'pipelineId' => 'pipe-2',
            'name' => 'رسیدگی به نیاز',
            'mappedStatus' => 'Qualification',
            default => null,
        });
        $em = $this->createMock(\Espo\ORM\EntityManager::class);
        $em->expects($this->once())
            ->method('getEntityById')
            ->with('PipelineStage', 'pipe2-stage-qualification')
            ->willReturn($stage);
        $em->expects($this->never())->method('getRDBRepository');

        $hook = new PipelineStageSync($em);
        $hook->beforeSave($opp, $this->createMock(\Espo\ORM\Repository\Option\SaveOptions::class));

        $this->assertSame('pipe-1', $values['pipelineId']);
        $this->assertSame('Prospecting', $values['stage']);
    }

    public function testApplySyncDataDoesNotCrossPipelineBoundaries(): void
    {
        $stages = [
            [
                'id' => 'pipe2-stage-qualification',
                'name' => 'رسیدگی به نیاز',
                'pipelineId' => 'pipe-2',
                'mappedStatus' => 'Qualification',
            ],
            [
                'id' => 'pipe1-stage-qualification',
                'name' => 'پیگیری و مذاکره',
                'pipelineId' => 'pipe-1',
                'mappedStatus' => 'Qualification',
            ],
        ];

        $result = PipelineStageSync::applySyncData([
            'pipelineId' => 'pipe-1',
            'stage' => 'Qualification',
        ], $stages);

        $this->assertSame('pipe1-stage-qualification', $result['pipelineStageId']);
        $this->assertSame('pipe-1', $result['pipelineId']);
        $this->assertSame('پیگیری و مذاکره', $result['pipelineStageName']);
    }

    public function testApplySyncDataDoesNotUseStageIdFromAnotherPipeline(): void
    {
        $input = [
            'pipelineId' => 'pipe-1',
            'pipelineStageId' => 'pipe2-stage-qualification',
            'stage' => 'Prospecting',
        ];
        $stages = [
            [
                'id' => 'pipe2-stage-qualification',
                'name' => 'رسیدگی به نیاز',
                'pipelineId' => 'pipe-2',
                'mappedStatus' => 'Qualification',
            ],
        ];

        $result = PipelineStageSync::applySyncData($input, $stages);

        $this->assertSame($input, $result);
    }

    public function testPipelineFallbackOnlyUsesOpportunityPipelines(): void
    {
        $pipeline = $this->createMock(\Espo\ORM\Entity::class);
        $pipeline->method('getId')->willReturn('opportunity-pipeline');
        $pipeline->method('get')->with('name')->willReturn('کاریز فروش');

        $builder = $this->createMock(\Espo\ORM\Repository\RDBSelectBuilder::class);
        $builder->expects($this->once())->method('findOne')->willReturn($pipeline);
        $repo = $this->createMock(\Espo\ORM\Repository\RDBRepository::class);
        $repo->expects($this->once())
            ->method('where')
            ->with(['entityType' => 'Opportunity'])
            ->willReturn($builder);

        $em = $this->createMock(\Espo\ORM\EntityManager::class);
        $em->expects($this->once())->method('getRDBRepository')->with('Pipeline')->willReturn($repo);

        $values = ['pipelineId' => null];
        $opp = $this->createMock(\Espo\ORM\Entity::class);
        $opp->method('isNew')->willReturn(false);
        $opp->method('isAttributeChanged')->willReturn(false);
        $opp->method('get')->willReturnCallback(fn (string $field) => $values[$field] ?? null);
        $opp->method('set')->willReturnCallback(function ($key, $value = null) use (&$values, $opp) {
            $values[$key] = $value;
            return $opp;
        });

        $hook = new PipelineStageSync($em);
        $hook->beforeSave($opp, $this->createMock(\Espo\ORM\Repository\Option\SaveOptions::class));

        $this->assertSame('opportunity-pipeline', $values['pipelineId']);
        $this->assertSame('کاریز فروش', $values['pipelineName']);
    }
}
