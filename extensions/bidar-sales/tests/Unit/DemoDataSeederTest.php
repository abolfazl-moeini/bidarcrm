<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Modules\BidarSales\Seed\DemoDataSeeder;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\RDBRepository;
use Espo\ORM\Repository\RDBSelectBuilder;
use PHPUnit\Framework\TestCase;

class DemoDataSeederTest extends TestCase
{
    private EntityManager $entityManager;

    /**
     * @var array<string, list<Entity>>
     */
    private array $dbStore = [];

    private int $idCounter = 1;

    protected function setUp(): void
    {
        $this->dbStore = [];
        $this->idCounter = 1;

        $this->entityManager = $this->createMock(EntityManager::class);

        $this->entityManager->method('getRepository')->willReturnCallback(function (string $entityType) {
            return $this->createMockRepository($entityType);
        });

        $this->entityManager->method('createEntity')->willReturnCallback(function (string $entityType, array $data = []) {
            $attributes = $data;
            if (!isset($attributes['id'])) {
                $attributes['id'] = 'mock_id_' . ($this->idCounter++);
            }

            $entity = $this->createMock(Entity::class);

            $entity->method('get')->willReturnCallback(function (string $key) use (&$attributes) {
                return $attributes[$key] ?? null;
            });

            $entity->method('getId')->willReturnCallback(function () use (&$attributes) {
                return $attributes['id'] ?? null;
            });

            $entity->method('set')->willReturnCallback(function ($key, $val = null) use (&$attributes, $entity) {
                if (is_array($key)) {
                    foreach ($key as $k => $v) {
                        $attributes[$k] = $v;
                    }
                } else {
                    $attributes[$key] = $val;
                }
                return $entity;
            });

            $entity->method('has')->willReturnCallback(function (string $key) use (&$attributes) {
                return array_key_exists($key, $attributes);
            });

            $this->dbStore[$entityType][] = $entity;
            return $entity;
        });

        $this->entityManager->method('saveEntity')->willReturnCallback(function (Entity $entity) {
            return $entity;
        });
    }

    private function createMockRepository(string $entityType): RDBRepository
    {
        $repo = $this->createMock(RDBRepository::class);

        $repo->method('where')->willReturnCallback(function (array $clause) use ($entityType) {
            $selectBuilder = $this->createMock(RDBSelectBuilder::class);

            $selectBuilder->method('findOne')->willReturnCallback(function () use ($entityType, $clause) {
                $items = $this->dbStore[$entityType] ?? [];
                foreach ($items as $item) {
                    $matched = true;
                    foreach ($clause as $field => $val) {
                        if ($item->get($field) !== $val) {
                            $matched = false;
                            break;
                        }
                    }
                    if ($matched) {
                        return $item;
                    }
                }
                return null;
            });

            return $selectBuilder;
        });

        return $repo;
    }

    public function testSeedProducesExpectedCounts(): void
    {
        $seeder = new DemoDataSeeder($this->entityManager);
        $adminUserId = 'admin_user_001';

        $loggedMessages = [];
        $logger = function (string $msg) use (&$loggedMessages) {
            $loggedMessages[] = $msg;
        };

        $summary = $seeder->seed($adminUserId, $logger);

        $this->assertSame(1, $summary['pipelines']);
        $this->assertSame(6, $summary['pipelineStages']);
        $this->assertSame(6, $summary['accounts']);
        $this->assertSame(6, $summary['contacts']);
        $this->assertSame(8, $summary['opportunities'], 'Must seed exactly 8 opportunities (6 active + 1 rotten + 1 closed lost)');
        $this->assertSame(5, $summary['tasks']);
        $this->assertSame(2, $summary['calls']);
        $this->assertSame(5, $summary['meetings']);
        $this->assertSame(5, $summary['leads']);
        $this->assertSame(4, $summary['products']);
        $this->assertSame(4, $summary['dealItems']);
        $this->assertSame(1, $summary['goals']);
        $this->assertSame(2, $summary['smsTemplates']);
        $this->assertSame(4, $summary['notes']);

        $this->assertNotEmpty($loggedMessages);
    }

    public function testSeedIsOneHundredPercentIdempotent(): void
    {
        $seeder = new DemoDataSeeder($this->entityManager);
        $adminUserId = 'admin_user_001';

        // Run 1: initial seed
        $summary1 = $seeder->seed($adminUserId);

        // Snapshot total records stored in memory
        $totalEntitiesRun1 = 0;
        foreach ($this->dbStore as $type => $entities) {
            $totalEntitiesRun1 += count($entities);
        }

        // Run 2: re-seed on populated store
        $summary2 = $seeder->seed($adminUserId);

        $totalEntitiesRun2 = 0;
        foreach ($this->dbStore as $type => $entities) {
            $totalEntitiesRun2 += count($entities);
        }

        // Idempotency assertions
        $this->assertSame($summary1, $summary2, 'Second seed run must return identical summary array');
        $this->assertSame($totalEntitiesRun1, $totalEntitiesRun2, 'Running seed multiple times must create 0 duplicate records');
    }

    public function testSeedAssignsAdminUserIdToEntities(): void
    {
        $seeder = new DemoDataSeeder($this->entityManager);
        $adminUserId = 'admin_user_vip';

        $seeder->seed($adminUserId);

        // Verify accounts
        foreach ($this->dbStore['Account'] as $acc) {
            $this->assertSame($adminUserId, $acc->get('assignedUserId'));
        }

        // Verify contacts
        foreach ($this->dbStore['Contact'] as $contact) {
            $this->assertSame($adminUserId, $contact->get('assignedUserId'));
        }

        // Verify opportunities
        foreach ($this->dbStore['Opportunity'] as $opp) {
            $this->assertSame($adminUserId, $opp->get('assignedUserId'));
        }

        // Verify tasks
        foreach ($this->dbStore['Task'] as $task) {
            $this->assertSame($adminUserId, $task->get('assignedUserId'));
        }

        // Verify calls
        foreach ($this->dbStore['Call'] as $call) {
            $this->assertSame($adminUserId, $call->get('assignedUserId'));
        }

        // Verify meetings
        foreach ($this->dbStore['Meeting'] as $meeting) {
            $this->assertSame($adminUserId, $meeting->get('assignedUserId'));
        }

        // Verify leads
        foreach ($this->dbStore['Lead'] as $lead) {
            $this->assertSame($adminUserId, $lead->get('assignedUserId'));
        }

        // Verify goals
        foreach ($this->dbStore['BidarGoal'] as $goal) {
            $this->assertSame($adminUserId, $goal->get('assignedUserId'));
        }
    }

    public function testDealsContainRottenDealAndClosedLostDeal(): void
    {
        $seeder = new DemoDataSeeder($this->entityManager);
        $seeder->seed('admin_user_001');

        $opportunities = $this->dbStore['Opportunity'] ?? [];
        $this->assertCount(8, $opportunities);

        // Find rotten deal
        $rottenFound = false;
        $closedLostFound = false;

        foreach ($opportunities as $opp) {
            if ($opp->get('name') === 'استقرار زیرساخت پایگاه‌داده دارویی زیست‌یار') {
                $rottenFound = true;
                $this->assertNotNull($opp->get('lastActivityAt'));
                $this->assertLessThan(
                    date('Y-m-d H:i:s', strtotime('-5 days')),
                    $opp->get('lastActivityAt')
                );
            }

            if ($opp->get('stage') === 'Closed Lost') {
                $closedLostFound = true;
                $this->assertSame('PriceTooHigh', $opp->get('lossReason'));
                $this->assertNotEmpty($opp->get('lossReasonNote'));
            }
        }

        $this->assertTrue($rottenFound, 'Sample rotten deal must be seeded with old lastActivityAt');
        $this->assertTrue($closedLostFound, 'Closed lost deal must be seeded with PriceTooHigh lossReason');
    }

    public function testSeedUsesKarijTerminologyAndMatchesDealItemTotals(): void
    {
        $seeder = new DemoDataSeeder($this->entityManager);
        $seeder->seed('admin_user_001');

        $opportunities = $this->dbStore['Opportunity'] ?? [];
        $itemTotals = [];
        foreach ($this->dbStore['BidarDealItem'] ?? [] as $item) {
            $opportunityId = (string) $item->get('opportunityId');
            $itemTotals[$opportunityId] = ($itemTotals[$opportunityId] ?? 0.0) + (float) $item->get('lineTotal');
        }

        foreach ($opportunities as $opp) {
            $desc = (string) ($opp->get('description') ?? '');
            $this->assertStringNotContainsString('پایپلاین', $desc);
            $this->assertStringNotContainsString('پایپ‌لاین', $desc);
            $this->assertStringNotContainsString('خط لوله', $desc);

            if ($opp->get('name') === 'سامانه یکپارچه‌سازی ERP با نرم‌افزار فروش کیمیا') {
                $this->assertSame(195000000, (int) $opp->get('amount'));
                $this->assertSame(195000000.0, $itemTotals[$opp->getId()]);
            }
            if ($opp->get('name') === 'پشتیبانی سالانه و لایسنس سرور اختصاصی زرین‌دشت') {
                $this->assertSame(81500000, (int) $opp->get('amount'));
                $this->assertSame(81500000.0, $itemTotals[$opp->getId()]);
            }
            if ($opp->get('name') === 'داشبورد هوش تجاری و پیگیری خودکار سفارشات باران') {
                $this->assertStringContainsString('کاریز', $desc);
            }
        }
    }

    public function testRottenActivityDateIsReappliedAfterNotesWithoutHooks(): void
    {
        $seeder = new DemoDataSeeder($this->entityManager);
        $seeder->seed('admin_user_001');

        $rottenOpportunity = null;
        foreach ($this->dbStore['Opportunity'] as $opportunity) {
            if ($opportunity->get('name') === 'استقرار زیرساخت پایگاه‌داده دارویی زیست‌یار') {
                $rottenOpportunity = $opportunity;
                break;
            }
        }
        $this->assertNotNull($rottenOpportunity);

        // Simulate Task/Note activity hooks replacing the aged timestamp on a later run.
        $rottenOpportunity->set('lastActivityAt', date('Y-m-d H:i:s'));
        $expectedActivityDate = date('Y-m-d H:i:s', strtotime('-10 days'));

        $this->entityManager->expects($this->once())
            ->method('saveEntity')
            ->with($rottenOpportunity, ['silent' => true, 'skipHooks' => true])
            ->willReturnCallback(function (Entity $entity, array $options = []) use ($expectedActivityDate): Entity {
                $this->assertSame($expectedActivityDate, $entity->get('lastActivityAt'));
                return $entity;
            });

        $seeder->seed('admin_user_001');

        $this->assertSame($expectedActivityDate, $rottenOpportunity->get('lastActivityAt'));
    }
}
