<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\Acl;
use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Container;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\InjectableFactory;
use Espo\Core\Select\SelectBuilder;
use Espo\Core\Select\SelectBuilderFactory;
use Espo\Entities\User;
use Espo\Modules\BidarIran\Support\JalaliHelper;
use Espo\Modules\BidarSales\Api\GetDashboardSummary;
use Espo\Modules\BidarSales\Services\DashboardSummaryService;
use Espo\ORM\Entity;
use Espo\ORM\EntityCollection;
use Espo\ORM\EntityManager;
use Espo\ORM\Query\Select;
use Espo\ORM\Repository\RDBRepository;
use Espo\ORM\Repository\RDBSelectBuilder;
use PHPUnit\Framework\TestCase;

class DashboardSummaryServiceTest extends TestCase
{
    private DashboardSummaryService $service;
    private bool $goalRepositoryAccessed = false;
    private array $dashboardQueryReads = [];

    protected function setUp(): void
    {
        $this->service = new DashboardSummaryService();
    }

    public function testRoutesJsonDefinesDashboardSummaryAction(): void
    {
        $routesFile = dirname(__DIR__, 2) . '/Resources/routes.json';
        $this->assertFileExists($routesFile);

        $routes = json_decode((string) file_get_contents($routesFile), true);
        $this->assertIsArray($routes);

        $found = false;
        foreach ($routes as $route) {
            if (($route['route'] ?? '') === '/BidarDashboard/summary' && ($route['method'] ?? '') === 'get') {
                $found = true;
                $this->assertSame(
                    'Espo\\Modules\\BidarSales\\Api\\GetDashboardSummary',
                    $route['actionClassName'] ?? null
                );
            }
        }
        $this->assertTrue($found, 'GET /BidarDashboard/summary route must be registered with actionClassName');
    }

    public function testGetDashboardSummaryImplementsEspoActionInterface(): void
    {
        $action = new GetDashboardSummary($this->service);
        $this->assertInstanceOf(Action::class, $action);

        $request = $this->createMock(Request::class);
        $request->method('getQueryParam')->willReturn(null);

        $response = $action->process($request);
        $this->assertInstanceOf(Response::class, $response);
        $this->assertSame(200, $response->getStatusCode());
    }

    public function testGetDashboardSummaryThrowsForbiddenWhenAclDeniesOpportunityRead(): void
    {
        $acl = $this->createMock(Acl::class);
        $acl->expects($this->once())
            ->method('check')
            ->with('Opportunity', 'read')
            ->willReturn(false);

        $action = new GetDashboardSummary($this->service, null, $acl);
        $request = $this->createMock(Request::class);

        $this->expectException(Forbidden::class);
        $this->expectExceptionMessage('Access denied to Opportunity data.');
        $action->process($request);
    }

    public function testGetDashboardSummaryAllowsWhenAclAllowsOpportunityRead(): void
    {
        $acl = $this->createMock(Acl::class);
        $acl->expects($this->once())
            ->method('check')
            ->with('Opportunity', 'read')
            ->willReturn(true);

        $action = new GetDashboardSummary($this->service, null, $acl);
        $request = $this->createMock(Request::class);
        $request->method('getQueryParam')->willReturn(null);

        $response = $action->process($request);
        $this->assertSame(200, $response->getStatusCode());
    }

    public function testGetDashboardSummaryResolvesAclFromContainer(): void
    {
        $acl = $this->createMock(Acl::class);
        $acl->expects($this->once())
            ->method('check')
            ->with('Opportunity', 'read')
            ->willReturn(false);

        $container = $this->createMock(Container::class);
        $container->method('has')->with('acl')->willReturn(true);
        $container->method('get')->with('acl')->willReturn($acl);

        $action = new GetDashboardSummary($this->service, null, null, $container);
        $request = $this->createMock(Request::class);

        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public function testAggregateDashboardSummaryCalculatesMetrics(): void
    {
        $deals = [
            [
                'id' => 'deal-1',
                'amount' => 10000000,
                'stage' => 'Initial Contact',
                'stageProbability' => 'In Progress',
                'isRotten' => true,
                'assignedUserId' => 'user-1',
                'assignedUserName' => 'علی محمدی',
                'source' => 'وب‌سایت',
            ],
            [
                'id' => 'deal-2',
                'amount' => 25000000,
                'stage' => 'Negotiation',
                'stageProbability' => 'In Progress',
                'isRotten' => false,
                'assignedUserId' => 'user-2',
                'assignedUserName' => 'سارا احمدی',
                'source' => 'معرفی',
            ],
            [
                'id' => 'deal-3',
                'amount' => 50000000,
                'stage' => 'Closed Won',
                'stageProbability' => 'Closed Won',
                'isRotten' => false,
                'createdAt' => '2026-11-01 10:00:00',
                'closeDate' => '2026-11-11',
                'assignedUserId' => 'user-1',
                'assignedUserName' => 'علی محمدی',
                'source' => 'وب‌سایت',
            ],
            [
                'id' => 'deal-4',
                'amount' => 15000000,
                'stage' => 'Closed Lost',
                'stageProbability' => 'Closed Lost',
                'lossReason' => 'PriceTooHigh',
                'assignedUserId' => 'user-2',
                'assignedUserName' => 'سارا احمدی',
                'source' => 'کمپین پیامکی',
            ],
            [
                'id' => 'deal-5',
                'amount' => 20000000,
                'stage' => 'Closed Lost',
                'stageProbability' => 'Closed Lost',
                'lossReason' => 'Competitor',
                'assignedUserId' => 'user-1',
                'assignedUserName' => 'علی محمدی',
                'source' => 'وب‌سایت',
            ],
            [
                'id' => 'deal-6',
                'amount' => 10000000,
                'stage' => 'Closed Lost',
                'stageProbability' => 'Closed Lost',
                'lossReason' => 'PriceTooHigh',
                'assignedUserId' => 'user-1',
                'assignedUserName' => 'علی محمدی',
                'source' => 'معرفی',
            ],
        ];

        $activities = [
            ['id' => 'act-1', 'status' => 'Planned', 'isOverdue' => true],
            ['id' => 'act-2', 'status' => 'Planned', 'isOverdue' => false],
            ['id' => 'act-3', 'status' => 'Held', 'isOverdue' => false],
        ];

        $stages = [
            ['id' => 's-1', 'name' => 'Initial Contact', 'color' => '#6366f1'],
            ['id' => 's-2', 'name' => 'Negotiation', 'color' => '#3b82f6'],
            ['id' => 's-3', 'name' => 'Closed Won', 'color' => '#10b981'],
        ];

        $summary = $this->service->calculateSummary($deals, $activities, $stages);

        // Core preserved metrics
        $this->assertSame(2, $summary['openCount']);
        $this->assertSame(35000000.0, (float) $summary['openAmount']);
        $this->assertSame(1, $summary['wonCount']);
        $this->assertSame(50000000.0, (float) $summary['wonAmount']);
        $this->assertSame(1, $summary['rottenCount']);
        $this->assertSame(1, $summary['overdueActivitiesCount']);
        $this->assertCount(3, $summary['funnelStages']);
        $this->assertSame('s-1', $summary['funnelStages'][0]['stageId']);
        $this->assertSame('Initial Contact', $summary['funnelStages'][0]['stageName']);
        $this->assertSame('#6366f1', $summary['funnelStages'][0]['color']);
        $this->assertSame(1, $summary['funnelStages'][0]['count']);
        $this->assertSame(10000000.0, (float) $summary['funnelStages'][0]['amount']);

        // GAP-03 Metric 1: conversionRate
        // wonCount = 1, lostCount = 3 => 1 / (1 + 3) = 25.0%
        $this->assertArrayHasKey('conversionRate', $summary);
        $this->assertSame(25.0, $summary['conversionRate']);

        // GAP-03 Metric 2: avgSalesCycleDays
        // 2026-11-01 to 2026-11-11 = 10.0 days
        $this->assertArrayHasKey('avgSalesCycleDays', $summary);
        $this->assertSame(10.0, $summary['avgSalesCycleDays']);

        // GAP-03 Metric 3: lossReasonsBreakdown
        $this->assertArrayHasKey('lossReasonsBreakdown', $summary);
        $lossReasons = $summary['lossReasonsBreakdown'];
        $this->assertCount(2, $lossReasons);
        // PriceTooHigh has 2 deals (deal-4: 15m + deal-6: 10m = 25m), Competitor has 1 deal (20m)
        $this->assertSame('PriceTooHigh', $lossReasons[0]['reason']);
        $this->assertSame('قیمت بالا', $lossReasons[0]['label']);
        $this->assertSame(2, $lossReasons[0]['count']);
        $this->assertSame(25000000.0, (float) $lossReasons[0]['amount']);

        $this->assertSame('Competitor', $lossReasons[1]['reason']);
        $this->assertSame('انتخاب رقیب', $lossReasons[1]['label']);
        $this->assertSame(1, $lossReasons[1]['count']);
        $this->assertSame(20000000.0, (float) $lossReasons[1]['amount']);

        // GAP-03 Metric 4: topSalesReps
        $this->assertArrayHasKey('topSalesReps', $summary);
        $topReps = $summary['topSalesReps'];
        $this->assertCount(2, $topReps);
        // user-1 has 50m wonAmount, user-2 has 0 wonAmount
        $this->assertSame('user-1', $topReps[0]['userId']);
        $this->assertSame('علی محمدی', $topReps[0]['userName']);
        $this->assertSame(1, $topReps[0]['wonCount']);
        $this->assertSame(50000000.0, (float) $topReps[0]['wonAmount']);
        $this->assertSame(1, $topReps[0]['openCount']);
        $this->assertSame(1, $topReps[0]['rottenCount']);

        $this->assertSame('user-2', $topReps[1]['userId']);
        $this->assertSame('سارا احمدی', $topReps[1]['userName']);
        $this->assertSame(0, $topReps[1]['wonCount']);
        $this->assertSame(0.0, (float) $topReps[1]['wonAmount']);
        $this->assertSame(1, $topReps[1]['openCount']);
        $this->assertSame(0, $topReps[1]['rottenCount']);

        // GAP-03 Metric 5: leadSourceBreakdown
        $this->assertArrayHasKey('leadSourceBreakdown', $summary);
        $sources = $summary['leadSourceBreakdown'];
        // وب‌سایت: 3 deals (deal-1, deal-3, deal-5), 1 won, 50m
        // معرفی: 2 deals (deal-2, deal-6)
        // کمپین پیامکی: 1 deal (deal-4)
        $this->assertCount(3, $sources);
        $this->assertSame('وب‌سایت', $sources[0]['source']);
        $this->assertSame(3, $sources[0]['count']);
        $this->assertSame(1, $sources[0]['wonCount']);
        $this->assertSame(50000000.0, (float) $sources[0]['wonAmount']);
    }

    public function testConversionRateIsZeroWhenNoClosedDeals(): void
    {
        $deals = [
            ['id' => 'd-1', 'amount' => 1000, 'stageProbability' => 'In Progress'],
        ];

        $summary = $this->service->calculateSummary($deals, [], []);
        $this->assertSame(0.0, $summary['conversionRate']);
        $this->assertSame(0.0, $summary['avgSalesCycleDays']);
        $this->assertSame([], $summary['lossReasonsBreakdown']);
    }

    public function testGoalProgressCalculation(): void
    {
        $deals = [
            ['id' => 'd-1', 'amount' => 40000000, 'stageProbability' => 'Closed Won', 'assignedUserId' => 'u1', 'closeDate' => '2026-11-10'],
            ['id' => 'd-2', 'amount' => 30000000, 'stageProbability' => 'Closed Won', 'assignedUserId' => 'u2', 'closeDate' => '2026-11-12'],
            ['id' => 'd-3', 'amount' => 20000000, 'stageProbability' => 'In Progress', 'assignedUserId' => 'u1', 'createdAt' => '2026-11-05'],
        ];

        $activities = [
            ['id' => 'a-1', 'status' => 'Held', 'assignedUserId' => 'u1'],
            ['id' => 'a-2', 'status' => 'Held', 'assignedUserId' => 'u2'],
            ['id' => 'a-3', 'status' => 'Planned', 'assignedUserId' => 'u1'],
        ];

        // 1. All users wonAmount goal: target 100,000,000, actual 70,000,000 => 70.0%
        $goalAmount = [
            'id' => 'g-1',
            'name' => 'هدف فروش آبان',
            'metricType' => 'wonAmount',
            'scopeType' => 'all',
            'targetValue' => 100000000.0,
        ];
        $res = $this->service->calculateGoalProgress($goalAmount, ['deals' => $deals]);
        $this->assertSame(70000000.0, $res['currentValue']);
        $this->assertSame(70.0, $res['progressPercent']);

        // 2. Specific user wonCount goal: target 2, actual u1 has 1 won deal => 50.0%
        $goalUserCount = [
            'id' => 'g-2',
            'name' => 'هدف تعداد فروش علی',
            'metricType' => 'wonCount',
            'scopeType' => 'user',
            'assignedUserId' => 'u1',
            'targetValue' => 2.0,
        ];
        $resUser = $this->service->calculateGoalProgress($goalUserCount, ['deals' => $deals]);
        $this->assertSame(1.0, $resUser['currentValue']);
        $this->assertSame(50.0, $resUser['progressPercent']);

        // 3. Activities held goal: target 5, actual 2 held => 40.0%
        $goalAct = [
            'id' => 'g-3',
            'name' => 'جلسات برگزار شده',
            'metricType' => 'activitiesHeld',
            'scopeType' => 'all',
            'targetValue' => 5.0,
        ];
        $resAct = $this->service->calculateGoalProgress($goalAct, ['activities' => $activities]);
        $this->assertSame(2.0, $resAct['currentValue']);
        $this->assertSame(40.0, $resAct['progressPercent']);
    }

    public function testGetDashboardSummaryResolvesJalaliPeriods(): void
    {
        $action = new GetDashboardSummary($this->service);

        $currentMonth = $action->resolveJalaliPeriod('current_month');
        $this->assertNotNull($currentMonth['dateFrom']);
        $this->assertNotNull($currentMonth['dateTo']);
        $this->assertStringContainsString('00:00:00', (string) $currentMonth['dateFrom']);
        $this->assertStringContainsString('23:59:59', (string) $currentMonth['dateTo']);

        $lastMonth = $action->resolveJalaliPeriod('last_month');
        $this->assertNotNull($lastMonth['dateFrom']);
        $this->assertNotNull($lastMonth['dateTo']);

        $quarter = $action->resolveJalaliPeriod('current_quarter');
        $this->assertNotNull($quarter['dateFrom']);
        $this->assertNotNull($quarter['dateTo']);

        $empty = $action->resolveJalaliPeriod(null);
        $this->assertNull($empty['dateFrom']);
        $this->assertNull($empty['dateTo']);
    }

    public function testDealToStageMatchingWithStageIdAndStageName(): void
    {
        $stages = [
            ['id' => 'stg-101', 'name' => 'مذاکره اولیه', 'color' => '#3b82f6'],
            ['id' => 'stg-102', 'name' => 'پیشنهاد قیمت', 'color' => '#10b981'],
        ];

        // deal-1 references stage by ID 'stg-101', deal-2 references stage by Name 'پیشنهاد قیمت'
        $deals = [
            [
                'id' => 'd-1',
                'amount' => 15000000,
                'stage' => 'stg-101',
                'stageProbability' => 'In Progress',
            ],
            [
                'id' => 'd-2',
                'amount' => 25000000,
                'stage' => 'پیشنهاد قیمت',
                'stageProbability' => 'In Progress',
            ],
        ];

        $summary = $this->service->calculateSummary($deals, [], $stages);

        $this->assertSame(2, $summary['openCount']);
        $this->assertSame(40000000.0, (float) $summary['openAmount']);
        $this->assertCount(2, $summary['funnelStages']);

        // First stage matched by ID
        $this->assertSame('stg-101', $summary['funnelStages'][0]['stageId']);
        $this->assertSame(1, $summary['funnelStages'][0]['count']);
        $this->assertSame(15000000.0, (float) $summary['funnelStages'][0]['amount']);

        // Second stage matched by Name
        $this->assertSame('stg-102', $summary['funnelStages'][1]['stageId']);
        $this->assertSame(1, $summary['funnelStages'][1]['count']);
        $this->assertSame(25000000.0, (float) $summary['funnelStages'][1]['amount']);
    }

    public function testProbabilityReadingFallbacks(): void
    {
        $stages = [
            ['id' => 's1', 'name' => 'مذاکره'],
        ];

        // deal with 'probability' = 'Closed Won', deal with 'probability' = 100, deal with 'probability' = 'Closed Lost'
        $deals = [
            [
                'id' => 'd-won-str',
                'amount' => 10000000,
                'stage' => 'مذاکره',
                'probability' => 'Closed Won',
                'createdAt' => '2026-11-01',
                'closeDate' => '2026-11-05',
            ],
            [
                'id' => 'd-won-num',
                'amount' => 20000000,
                'stage' => 'مذاکره',
                'probability' => 100,
                'createdAt' => '2026-11-01',
                'closeDate' => '2026-11-07',
            ],
            [
                'id' => 'd-lost',
                'amount' => 5000000,
                'stage' => 'مذاکره',
                'probability' => 'Closed Lost',
                'lossReason' => 'PriceTooHigh',
            ],
        ];

        $summary = $this->service->calculateSummary($deals, [], $stages);

        $this->assertSame(2, $summary['wonCount']);
        $this->assertSame(30000000.0, (float) $summary['wonAmount']);
        $this->assertSame(0, $summary['openCount']);
        $this->assertCount(1, $summary['lossReasonsBreakdown']);
        $this->assertSame('PriceTooHigh', $summary['lossReasonsBreakdown'][0]['reason']);
        $this->assertSame(1, $summary['lossReasonsBreakdown'][0]['count']);
        $this->assertSame(5000000.0, (float) $summary['lossReasonsBreakdown'][0]['amount']);
    }

    public function testCalculateGoalProgressActivitiesHeldDateFiltering(): void
    {
        $activities = [
            [
                'id' => 'act-in-range',
                'status' => 'Held',
                'dateStart' => '2026-11-15 10:00:00',
            ],
            [
                'id' => 'act-before-range',
                'status' => 'Held',
                'dateStart' => '2026-10-31 10:00:00',
            ],
            [
                'id' => 'act-after-range',
                'status' => 'Held',
                'createdAt' => '2026-12-05 10:00:00',
            ],
            [
                'id' => 'act-in-range-created',
                'status' => 'Held',
                'createdAt' => '2026-11-20 14:00:00',
            ],
            [
                'id' => 'act-not-held',
                'status' => 'Planned',
                'dateStart' => '2026-11-16 10:00:00',
            ],
        ];

        $goal = [
            'id' => 'g-nov-activities',
            'name' => 'جلسات برگزار شده آبان',
            'metricType' => 'activitiesHeld',
            'scopeType' => 'all',
            'dateStart' => '2026-11-01',
            'dateEnd' => '2026-11-30',
            'targetValue' => 10.0,
        ];

        $res = $this->service->calculateGoalProgress($goal, ['activities' => $activities]);

        // Only act-in-range and act-in-range-created fall within Nov 1 to Nov 30
        $this->assertSame(2.0, $res['currentValue']);
        $this->assertSame(20.0, $res['progressPercent']);
    }

    public function testBug01StandardEspoSchemaCalculationWithStageAndProbability(): void
    {
        // Deals without any 'stageProbability' key (standard EspoCRM schema)
        $deals = [
            [
                'id' => 'deal-won-1',
                'amount' => 60000000,
                'stage' => 'Closed Won',
                'probability' => 100,
                'pipelineStageId' => 'stage-won',
                'createdAt' => '2026-11-01',
                'closeDate' => '2026-11-10',
                'assignedUserId' => 'user-1',
            ],
            [
                'id' => 'deal-lost-1',
                'amount' => 20000000,
                'stage' => 'Closed Lost',
                'probability' => 0,
                'pipelineStageId' => 'stage-lost',
                'lossReason' => 'PriceTooHigh',
                'assignedUserId' => 'user-2',
            ],
            [
                'id' => 'deal-open-1',
                'amount' => 15000000,
                'stage' => 'Proposal',
                'probability' => 50,
                'pipelineStageId' => 'stage-prop',
                'assignedUserId' => 'user-1',
            ],
        ];

        $stages = [
            [
                'id' => 'stage-prop',
                'name' => 'پیشنهاد قیمت',
                'mappedStatus' => 'Proposal',
                'color' => '#6366f1',
            ],
            [
                'id' => 'stage-won',
                'name' => 'فروش موفق',
                'mappedStatus' => 'Closed Won',
                'color' => '#10b981',
            ],
            [
                'id' => 'stage-lost',
                'name' => 'انصراف',
                'mappedStatus' => 'Closed Lost',
                'color' => '#ef4444',
            ],
        ];

        $summary = $this->service->calculateSummary($deals, [], $stages);

        $this->assertSame(1, $summary['wonCount'], 'wonCount must be 1 for Closed Won deal');
        $this->assertSame(60000000.0, (float) $summary['wonAmount'], 'wonAmount must match won deal amount');
        $this->assertSame(1, $summary['lostCount'] ?? 0, 'lostCount must be 1 for Closed Lost deal');
        $this->assertSame(1, $summary['openCount'], 'openCount must be 1 for Proposal deal');
        $this->assertSame(15000000.0, (float) $summary['openAmount']);
        $this->assertSame(50.0, $summary['conversionRate'], 'conversionRate must be 50% (1 won / 2 closed)');

        $this->assertCount(1, $summary['lossReasonsBreakdown']);
        $this->assertSame('PriceTooHigh', $summary['lossReasonsBreakdown'][0]['reason']);
        $this->assertSame(1, $summary['lossReasonsBreakdown'][0]['count']);

        // Verify funnel stage mapped by pipelineStageId
        $this->assertSame(1, $summary['funnelStages'][0]['count']);
        $this->assertSame(15000000.0, (float) $summary['funnelStages'][0]['amount']);
    }

    public function testBug02OverdueActivitiesCountsTaskStatuses(): void
    {
        $activities = [
            ['id' => 'task-1', 'status' => 'Not Started', 'isOverdue' => true],
            ['id' => 'task-2', 'status' => 'Started', 'isOverdue' => true],
            ['id' => 'task-3', 'status' => 'Not Started', 'isOverdue' => false],
            ['id' => 'task-4', 'status' => 'Completed', 'isOverdue' => true],
            ['id' => 'call-1', 'status' => 'Planned', 'isOverdue' => true],
        ];

        $summary = $this->service->calculateSummary([], $activities, []);
        // task-1 (Not Started, overdue), task-2 (Started, overdue), call-1 (Planned, overdue) => 3
        $this->assertSame(3, $summary['overdueActivitiesCount']);
    }

    public function testBug03RecordLevelAclEnforcementWithSelectBuilderFactory(): void
    {
        $selectBuilderFactory = $this->createMock(SelectBuilderFactory::class);
        $oppSelectBuilder = $this->createMock(SelectBuilder::class);
        $taskSelectBuilder = $this->createMock(SelectBuilder::class);

        $oppQuery = $this->createMock(Select::class);
        $taskQuery = $this->createMock(Select::class);

        // Expect from('Opportunity')->withStrictAccessControl()->build()
        $oppSelectBuilder->expects($this->once())
            ->method('from')
            ->with('Opportunity')
            ->willReturnSelf();
        $oppSelectBuilder->expects($this->once())
            ->method('withStrictAccessControl')
            ->willReturnSelf();
        $oppSelectBuilder->expects($this->once())
            ->method('build')
            ->willReturn($oppQuery);

        // Expect from('Task')->withStrictAccessControl()->build()
        $taskSelectBuilder->expects($this->once())
            ->method('from')
            ->with('Task')
            ->willReturnSelf();
        $taskSelectBuilder->expects($this->once())
            ->method('withStrictAccessControl')
            ->willReturnSelf();
        $taskSelectBuilder->expects($this->once())
            ->method('build')
            ->willReturn($taskQuery);

        $selectBuilderFactory->expects($this->exactly(2))
            ->method('create')
            ->willReturnOnConsecutiveCalls($oppSelectBuilder, $taskSelectBuilder);

        $em = $this->createMock(EntityManager::class);
        $stageRepo = $this->createMock(RDBRepository::class);
        $oppRepo = $this->createMock(RDBRepository::class);
        $taskRepo = $this->createMock(RDBRepository::class);
        $goalRepo = $this->createMock(RDBRepository::class);

        $stageSelectBuilder = $this->createMock(RDBSelectBuilder::class);
        $stageSelectBuilder->method('where')->willReturnSelf();
        $stageSelectBuilder->method('order')->willReturnSelf();
        $stageSelectBuilder->method('find')->willReturn(new EntityCollection());

        $oppSelectBuilderObj = $this->createMock(RDBSelectBuilder::class);
        $oppSelectBuilderObj->method('where')->willReturnSelf();
        $oppSelectBuilderObj->method('find')->willReturn(new EntityCollection());

        $taskSelectBuilderObj = $this->createMock(RDBSelectBuilder::class);
        $taskSelectBuilderObj->method('where')->willReturnSelf();
        $taskSelectBuilderObj->method('find')->willReturn(new EntityCollection());

        $goalSelectBuilder = $this->createMock(RDBSelectBuilder::class);
        $goalSelectBuilder->method('where')->willReturnSelf();
        $goalSelectBuilder->method('find')->willReturn(new EntityCollection());
        $goalSelectBuilder->method('order')->willReturnSelf();
        $goalSelectBuilder->method('findOne')->willReturn(null);

        $stageRepo->method('where')->willReturn($stageSelectBuilder);
        $oppRepo->method('clone')->with($oppQuery)->willReturn($oppSelectBuilderObj);
        $oppRepo->method('where')->willReturn($oppSelectBuilderObj);
        $taskRepo->method('clone')->with($taskQuery)->willReturn($taskSelectBuilderObj);
        $taskRepo->method('where')->willReturn($taskSelectBuilderObj);
        $goalRepo->method('where')->willReturn($goalSelectBuilder);
        $goalRepo->method('order')->willReturn($goalSelectBuilder);

        $em->method('getRDBRepository')->willReturnCallback(function (string $name) use ($stageRepo, $oppRepo, $taskRepo, $goalRepo) {
            return match ($name) {
                'PipelineStage' => $stageRepo,
                'Opportunity' => $oppRepo,
                'Task' => $taskRepo,
                'BidarGoal' => $goalRepo,
            };
        });

        $acl = $this->createMock(Acl::class);
        $acl->method('check')->with('Opportunity', 'read')->willReturn(true);
        $acl->method('checkScope')->willReturn(true);
        $acl->method('checkEntityRead')->willReturn(true);

        $action = new GetDashboardSummary($this->service, $em, $acl, null, $selectBuilderFactory);
        $request = $this->createMock(Request::class);
        $request->method('getQueryParam')->willReturn(null);

        $response = $action->process($request);
        $this->assertSame(200, $response->getStatusCode());
    }

    public function testBug03ActiveBidarGoalPopulatedInPayload(): void
    {
        $em = $this->createMock(EntityManager::class);
        $stageRepo = $this->createMock(RDBRepository::class);
        $oppRepo = $this->createMock(RDBRepository::class);
        $taskRepo = $this->createMock(RDBRepository::class);
        $goalRepo = $this->createMock(RDBRepository::class);

        $stageSelectBuilder = $this->createMock(RDBSelectBuilder::class);
        $stageSelectBuilder->method('where')->willReturnSelf();
        $stageSelectBuilder->method('order')->willReturnSelf();
        $stageSelectBuilder->method('find')->willReturn(new EntityCollection());
        $stageRepo->method('where')->willReturn($stageSelectBuilder);

        $oppEntity = $this->createMock(Entity::class);
        $oppEntity->method('getId')->willReturn('opp-1');
        $oppEntity->method('get')->willReturnCallback(function (string $name) {
            return match ($name) {
                'amountConverted', 'amount' => 35000000,
                'stage' => 'Closed Won',
                'probability' => 100,
                'closeDate' => '2026-11-15',
                default => null,
            };
        });

        $oppSelectBuilder = $this->createMock(RDBSelectBuilder::class);
        $oppSelectBuilder->method('where')->willReturnSelf();
        $oppSelectBuilder->method('find')->willReturn(new EntityCollection([$oppEntity]));
        $oppRepo->method('where')->willReturn($oppSelectBuilder);

        $taskSelectBuilder = $this->createMock(RDBSelectBuilder::class);
        $taskSelectBuilder->method('where')->willReturnSelf();
        $taskSelectBuilder->method('find')->willReturn(new EntityCollection());
        $taskRepo->method('where')->willReturn($taskSelectBuilder);

        // Goal entity with targetValue 50,000,000
        $goalEntity = $this->createMock(Entity::class);
        $goalEntity->method('getId')->willReturn('goal-nov');
        $goalEntity->method('get')->willReturnCallback(function (string $name) {
            return match ($name) {
                'name' => 'هدف فروش آبان',
                'metricType' => 'wonAmount',
                'scopeType' => 'all',
                'targetValue' => 50000000.0,
                'dateStart' => '2026-11-01',
                'dateEnd' => '2026-11-30',
                default => null,
            };
        });

        $goalSelectBuilder = $this->createMock(RDBSelectBuilder::class);
        $goalSelectBuilder->method('where')->willReturnSelf();
        $goalSelectBuilder->method('find')->willReturn(new EntityCollection([$goalEntity]));
        $goalRepo->method('where')->willReturn($goalSelectBuilder);

        $em->method('getRDBRepository')->willReturnCallback(function (string $name) use ($stageRepo, $oppRepo, $taskRepo, $goalRepo) {
            return match ($name) {
                'PipelineStage' => $stageRepo,
                'Opportunity' => $oppRepo,
                'Task' => $taskRepo,
                'BidarGoal' => $goalRepo,
            };
        });

        $acl = $this->createMock(Acl::class);
        $acl->method('check')->with('Opportunity', 'read')->willReturn(true);
        $acl->method('checkScope')->willReturn(true);
        $acl->method('checkEntityRead')->willReturn(true);

        $action = new GetDashboardSummary($this->service, $em, $acl);
        $request = $this->createMock(Request::class);
        $request->method('getQueryParam')->willReturn(null);

        $response = $action->process($request);
        $this->assertSame(200, $response->getStatusCode());

        $data = json_decode((string) $response->getBody(), true);
        $this->assertIsArray($data);
        $this->assertArrayHasKey('goal', $data);
        $this->assertNotNull($data['goal']);

        // Must NOT fallback to 100,000,000; must contain actual goal
        $this->assertSame(50000000.0, (float) $data['goal']['targetAmount']);
        $this->assertSame(50000000.0, (float) $data['goal']['targetValue']);
        $this->assertSame(35000000.0, (float) $data['goal']['currentAmount']);
        $this->assertSame(35000000.0, (float) $data['goal']['currentValue']);
        $this->assertSame(70.0, (float) $data['goal']['percent']);
        $this->assertSame(70.0, (float) $data['goal']['progressPercent']);
    }

    public function testPipe01OpenDealWithZeroProbabilityIsNotCountedAsLost(): void
    {
        $deals = [
            [
                'id' => 'deal-zero-prob',
                'amount' => 50000000,
                'stage' => 'Proposal',
                'probability' => 0,
                'pipelineStageId' => 'stage-prop',
            ],
        ];

        $stages = [
            [
                'id' => 'stage-prop',
                'name' => 'پیشنهاد اولیه',
                'mappedStatus' => 'Proposal',
            ],
            [
                'id' => 'stage-lost',
                'name' => 'از دست رفته',
                'mappedStatus' => 'Closed Lost',
            ],
        ];

        $summary = $this->service->calculateSummary($deals, [], $stages);

        $this->assertSame(1, $summary['openCount'], 'Deal with probability=0 in open stage must be open');
        $this->assertSame(0, $summary['lostCount'], 'Deal with probability=0 in open stage must NOT be lost');
        $this->assertSame(50000000.0, (float) $summary['openAmount']);

        // Check funnel stages: stage-prop must have count 1
        $foundProp = false;
        foreach ($summary['funnelStages'] as $fst) {
            if ($fst['stageId'] === 'stage-prop') {
                $foundProp = true;
                $this->assertSame(1, $fst['count']);
                $this->assertSame(50000000.0, (float) $fst['amount']);
            }
        }
        $this->assertTrue($foundProp, 'Funnel must contain stage-prop with count 1');
    }

    public function testPipe02FunnelStagesDistinguishesSameNameStagesInDifferentPipelinesByStageId(): void
    {
        $stages = [
            [
                'id' => 'pipe1-stage-neg',
                'name' => 'مذاکره',
                'mappedStatus' => 'In Negotiation',
            ],
            [
                'id' => 'pipe2-stage-neg',
                'name' => 'مذاکره',
                'mappedStatus' => 'In Negotiation',
            ],
        ];

        $deals = [
            [
                'id' => 'deal-p1',
                'amount' => 10000000,
                'pipelineStageId' => 'pipe1-stage-neg',
                'stage' => 'Negotiation',
                'probability' => 50,
            ],
            [
                'id' => 'deal-p2',
                'amount' => 20000000,
                'pipelineStageId' => 'pipe2-stage-neg',
                'stage' => 'Negotiation',
                'probability' => 50,
            ],
        ];

        $summary = $this->service->calculateSummary($deals, [], $stages);

        $this->assertCount(2, $summary['funnelStages'], 'Funnel stages must have 2 entries, not overwritten by same name');

        $byStageId = [];
        foreach ($summary['funnelStages'] as $fst) {
            $byStageId[$fst['stageId']] = $fst;
        }

        $this->assertArrayHasKey('pipe1-stage-neg', $byStageId);
        $this->assertArrayHasKey('pipe2-stage-neg', $byStageId);
        $this->assertSame(1, $byStageId['pipe1-stage-neg']['count']);
        $this->assertSame(10000000.0, (float) $byStageId['pipe1-stage-neg']['amount']);
        $this->assertSame(1, $byStageId['pipe2-stage-neg']['count']);
        $this->assertSame(20000000.0, (float) $byStageId['pipe2-stage-neg']['amount']);
    }

    public function testPipe03UnifiedWonLogicBetweenSummaryAndGoalProgress(): void
    {
        $stages = [
            [
                'id' => 'st-won',
                'name' => 'موفق',
                'mappedStatus' => 'Closed Won',
            ],
        ];

        $deals = [
            [
                'id' => 'deal-won-mapped',
                'amount' => 40000000,
                'pipelineStageId' => 'st-won',
                'stage' => 'CustomWonStage',
            ],
        ];

        $goal = [
            'id' => 'g1',
            'name' => 'هدف فروش',
            'metricType' => 'wonAmount',
            'targetValue' => 100000000,
        ];

        $summary = $this->service->calculateSummary($deals, [], $stages, $goal);

        $this->assertSame(1, $summary['wonCount']);
        $this->assertSame(40000000.0, (float) $summary['wonAmount']);
        $this->assertNotNull($summary['goal']);
        $this->assertSame(40000000.0, (float) $summary['goal']['currentValue'], 'Goal currentValue must match wonAmount using unified isDealWon');
    }

    public function testAcl01FailClosedWhenSelectBuilderThrows(): void
    {
        $selectBuilderFactory = $this->createMock(SelectBuilderFactory::class);
        $selectBuilder = $this->createMock(SelectBuilder::class);
        $selectBuilderFactory->method('create')->willReturn($selectBuilder);
        $selectBuilder->method('from')->willReturnSelf();
        $selectBuilder->method('withStrictAccessControl')->willReturnSelf();
        $selectBuilder->method('build')->willThrowException(new \RuntimeException('Access check error'));

        $em = $this->createMock(EntityManager::class);
        $repo = $this->createMock(RDBRepository::class);
        $em->method('getRDBRepository')->willReturn($repo);

        $acl = $this->createMock(Acl::class);
        $acl->method('check')->with('Opportunity', 'read')->willReturn(true);
        $acl->method('checkScope')->willReturn(true);
        $acl->method('checkEntityRead')->willReturn(true);

        $action = new GetDashboardSummary($this->service, $em, $acl, null, $selectBuilderFactory);
        $request = $this->createMock(Request::class);
        $request->method('getQueryParam')->willReturn(null);

        // When strict access control throws, it must fail closed and rethrow/fail, NOT query without ACL
        $this->expectException(\RuntimeException::class);
        $action->process($request);
    }

    public function testMissingSelectBuilderFactoryIsCreatedThroughInjectableFactory(): void
    {
        $acl = $this->createMock(Acl::class);
        $acl->method('check')->with('Opportunity', 'read')->willReturn(true);

        $factory = $this->createMock(SelectBuilderFactory::class);
        $injectableFactory = $this->createMock(InjectableFactory::class);
        $injectableFactory->expects($this->once())
            ->method('create')
            ->with(SelectBuilderFactory::class)
            ->willReturn($factory);

        $action = new GetDashboardSummary($this->service, null, $acl, null, null, null, $injectableFactory);
        $request = $this->createMock(Request::class);
        $request->method('getQueryParam')->willReturn(null);

        $response = $action->process($request);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testResolveJalaliPeriodUtcAndDateToEndOfDay(): void
    {
        $action = new GetDashboardSummary($this->service);
        $now = new \DateTimeImmutable('2026-11-24 10:00:00', new \DateTimeZone('UTC'));
        $localRange = $action->resolveJalaliPeriod('current_month', $now, false);
        $utcRange = $action->resolveJalaliPeriod('current_month', $now, true);

        $this->assertStringEndsWith('00:00:00', $localRange['dateFrom']);
        $this->assertNotSame($localRange['dateFrom'], $utcRange['dateFrom']);
        $this->assertSame('2026-11-24 23:59:59', GetDashboardSummary::normalizeDateToBoundary('2026-11-24'));
    }

    public function testResolveCurrentMonthUsesInjectedClock(): void
    {
        $action = new GetDashboardSummary($this->service);
        $now = new \DateTimeImmutable('2026-01-15 10:00:00', new \DateTimeZone('UTC'));
        $expected = JalaliHelper::getJalaliMonthRange(1404, 10);

        $range = $action->resolveJalaliPeriod('current_month', $now, false);

        $this->assertSame($expected['start'], $range['dateFrom']);
        $this->assertSame($expected['end'], $range['dateTo']);
    }

    public function testOpenStageWithProbability100IsNotWonAndEmptyStageDoesNotCollide(): void
    {
        $stages = [
            ['id' => '', 'name' => '', 'mappedStatus' => 'Closed Won'],
            ['id' => 'st-neg', 'name' => 'مذاکره', 'mappedStatus' => 'Negotiation'],
        ];
        $deals = [
            [
                'id' => 'opp-open-100',
                'amount' => 15000000,
                'pipelineStageId' => 'st-neg',
                'stage' => 'Negotiation',
                'probability' => 100,
            ],
            [
                'id' => 'opp-empty-stage',
                'amount' => 5000000,
                'pipelineStageId' => '',
                'stage' => '',
                'probability' => 20,
            ],
        ];

        $summary = $this->service->calculateSummary($deals, [], $stages);

        $this->assertSame(0, $summary['wonCount']);
        $this->assertSame(2, $summary['openCount']);
    }

    public function testGoalProgressTeamScopeAndEmptyCloseDateAndDealsCreated(): void
    {
        $deals = [
            [
                'id' => 'd1',
                'amount' => 10000000,
                'stage' => 'Closed Won',
                'closeDate' => '',
                'createdAt' => '2026-01-01 10:00:00', // Outside goal window
                'assignedUserId' => 'u1',
                'teamIds' => ['team-a'],
            ],
            [
                'id' => 'd2',
                'amount' => 20000000,
                'stage' => 'Prospecting',
                'closeDate' => '',
                'createdAt' => '2026-11-15 10:00:00', // Inside goal window
                'assignedUserId' => 'u2',
                'teamIds' => ['team-a'],
            ],
            [
                'id' => 'd3',
                'amount' => 30000000,
                'stage' => 'Closed Won',
                'closeDate' => '2026-11-16',
                'createdAt' => '2026-11-16 10:00:00',
                'assignedUserId' => 'u3',
                'teamIds' => ['team-b'],
            ],
        ];

        $teamWonGoal = [
            'id' => 'g-team',
            'name' => 'هدف تیم الف',
            'metricType' => 'wonAmount',
            'scopeType' => 'team',
            'teamId' => 'team-a',
            'targetValue' => 50000000,
            'startDate' => '2026-11-01',
            'endDate' => '2026-11-30',
        ];
        $wonProgress = $this->service->calculateGoalProgress($teamWonGoal, $deals);
        $this->assertSame(0.0, (float) $wonProgress['currentValue']);

        $teamCreatedGoal = [
            'id' => 'g-created',
            'name' => 'ایجاد معامله تیم الف',
            'metricType' => 'dealsCreated',
            'scopeType' => 'team',
            'teamId' => 'team-a',
            'targetValue' => 5,
            'startDate' => '2026-11-01',
            'endDate' => '2026-11-30',
        ];
        $createdProgress = $this->service->calculateGoalProgress($teamCreatedGoal, $deals);
        $this->assertSame(1.0, (float) $createdProgress['currentValue']);
    }

    public function testTeamActivitiesGoalExcludesOtherAndUntetheredActivities(): void
    {
        $goal = [
            'id' => 'g-team-activities',
            'metricType' => 'activitiesHeld',
            'scopeType' => 'team',
            'teamId' => 'team-a',
            'targetValue' => 2.0,
        ];
        $activities = [
            ['status' => 'Held', 'teamIds' => ['team-a']],
            ['status' => 'Held', 'teamId' => 'team-a'],
            ['status' => 'Held', 'teamIds' => ['team-b']],
            ['status' => 'Held', 'teamIds' => []],
        ];

        $progress = $this->service->calculateGoalProgress($goal, ['activities' => $activities]);

        $this->assertSame(2.0, (float) $progress['currentValue']);
    }

    private function createDashboardActionCapturingWhere(array &$capturedWhere, array $queryParams, array $stages = []): array
    {
        $stageBuilder = $this->createMock(RDBSelectBuilder::class);
        $stageBuilder->method('where')->willReturnSelf();
        $stageBuilder->method('order')->willReturnSelf();
        $stageBuilder->method('find')->willReturn(new EntityCollection($stages));
        $stageRepo = $this->createMock(RDBRepository::class);
        $stageRepo->method('where')->willReturn($stageBuilder);

        $oppBuilder = $this->createMock(RDBSelectBuilder::class);
        $oppBuilder->method('find')->willReturn(new EntityCollection());
        $oppRepo = $this->createMock(RDBRepository::class);
        $oppRepo->method('where')->willReturnCallback(function (array $where) use (&$capturedWhere, $oppBuilder): RDBSelectBuilder {
            $capturedWhere = $where;
            return $oppBuilder;
        });

        $this->goalRepositoryAccessed = false;
        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->willReturnCallback(function (string $entityType) use ($stageRepo, $oppRepo): RDBRepository {
            if ($entityType === 'BidarGoal') {
                $this->goalRepositoryAccessed = true;
            }
            return match ($entityType) {
                'PipelineStage' => $stageRepo,
                'Opportunity' => $oppRepo,
                default => throw new \RuntimeException('Unexpected repository access: ' . $entityType),
            };
        });

        $acl = $this->createMock(Acl::class);
        $acl->method('check')->with('Opportunity', 'read')->willReturn(true);
        $acl->method('checkScope')->willReturnCallback(fn (string $scope, ?string $action = null): bool => $scope === 'Opportunity');

        $user = $this->createMock(User::class);
        $user->method('isAdmin')->willReturn(true);
        $user->method('getId')->willReturn('admin-1');

        $this->dashboardQueryReads = [];
        $request = $this->createMock(Request::class);
        $request->expects($this->exactly(5))
            ->method('getQueryParam')
            ->willReturnCallback(function (string $name) use ($queryParams): ?string {
                $this->dashboardQueryReads[$name] = $queryParams[$name] ?? null;
                return $queryParams[$name] ?? null;
            });

        return [
            new GetDashboardSummary($this->service, $em, $acl, null, null, $user),
            $request,
        ];
    }

    public function testProcessUsesUtcJalaliBoundariesAndNormalizesBlankDates(): void
    {
        $capturedWhere = [];
        [$action, $request] = $this->createDashboardActionCapturingWhere($capturedWhere, [
            'dateFrom' => '   ',
            'dateTo' => '',
            'jalaliPeriod' => 'current_month',
        ]);
        $expectedRange = $action->resolveJalaliPeriod('current_month', null, true);
        $localRange = $action->resolveJalaliPeriod('current_month', null, false);

        $response = $action->process($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('current_month', $this->dashboardQueryReads['jalaliPeriod'] ?? null);
        $this->assertSame('   ', $this->dashboardQueryReads['dateFrom'] ?? null);
        $this->assertSame('', $this->dashboardQueryReads['dateTo'] ?? null);
        $this->assertSame([
            'createdAt>=' => $expectedRange['dateFrom'],
            'createdAt<=' => $expectedRange['dateTo'],
        ], $capturedWhere);
        $this->assertNotSame($localRange['dateFrom'], $capturedWhere['createdAt>='] ?? null);
        $this->assertFalse($this->goalRepositoryAccessed);
    }

    public function testProcessExpandsDateOnlyEndToEndOfDay(): void
    {
        $capturedWhere = [];
        [$action, $request] = $this->createDashboardActionCapturingWhere($capturedWhere, [
            'dateFrom' => null,
            'dateTo' => '2026-11-24',
        ]);

        $action->process($request);

        $this->assertArrayNotHasKey('createdAt>=', $capturedWhere);
        $this->assertSame('2026-11-24 23:59:59', $capturedWhere['createdAt<='] ?? null);
        $this->assertFalse($this->goalRepositoryAccessed);
    }

    public function testProcessPropagatesPipelineStageColor(): void
    {
        $stage = $this->createMock(Entity::class);
        $stage->method('getId')->willReturn('stage-1');
        $stage->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'name' => 'مذاکره',
            'probability' => 50,
            'rottenDays' => 5,
            'mappedStatus' => 'Negotiation',
            'color' => '#123456',
            default => null,
        });
        $capturedWhere = [];
        [$action, $request] = $this->createDashboardActionCapturingWhere($capturedWhere, [], [$stage]);

        $response = $action->process($request);
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame('#123456', $data['funnelStages'][0]['color']);
        $this->assertNull($data['goal']);
        $this->assertFalse($this->goalRepositoryAccessed);
    }

    public function testDashboardDoesNotFallbackToAnotherUsersGoal(): void
    {
        $emptyBuilder = $this->createMock(RDBSelectBuilder::class);
        $emptyBuilder->method('where')->willReturnSelf();
        $emptyBuilder->method('order')->willReturnSelf();
        $emptyBuilder->method('find')->willReturn(new EntityCollection());

        $goalBuilder = $this->createMock(RDBSelectBuilder::class);
        $goalBuilder->method('where')->willReturnSelf();
        $goalBuilder->method('find')->willReturn(new EntityCollection());
        $goalBuilder->expects($this->never())->method('order');
        $goalBuilder->expects($this->never())->method('findOne');

        $stageRepo = $this->createMock(RDBRepository::class);
        $stageRepo->method('where')->willReturn($emptyBuilder);
        $oppRepo = $this->createMock(RDBRepository::class);
        $oppRepo->method('where')->willReturn($emptyBuilder);
        $goalRepo = $this->createMock(RDBRepository::class);
        $goalRepo->method('where')->willReturn($goalBuilder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->willReturnCallback(function (string $entityType) use ($stageRepo, $oppRepo, $goalRepo): RDBRepository {
            return match ($entityType) {
                'PipelineStage' => $stageRepo,
                'Opportunity' => $oppRepo,
                'BidarGoal' => $goalRepo,
                default => throw new \RuntimeException('Unexpected repository access: ' . $entityType),
            };
        });

        $acl = $this->createMock(Acl::class);
        $acl->method('check')->with('Opportunity', 'read')->willReturn(true);
        $acl->method('checkScope')->willReturnCallback(fn (string $scope): bool => in_array($scope, ['Opportunity', 'BidarGoal'], true));

        $user = $this->createMock(User::class);
        $user->method('isAdmin')->willReturn(false);
        $user->method('getId')->willReturn('user-1');
        $user->method('getTeamIdList')->willReturn([]);

        $action = new GetDashboardSummary($this->service, $em, $acl, null, null, $user);
        $response = $action->process($this->createMock(Request::class));
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        $this->assertNull($data['goal']);
    }

    public function testTeamGoalLoadsHeldCallsAndMeetingsWithoutOverdueInflation(): void
    {
        $emptyBuilder = $this->createMock(RDBSelectBuilder::class);
        $emptyBuilder->method('where')->willReturnSelf();
        $emptyBuilder->method('order')->willReturnSelf();
        $emptyBuilder->method('find')->willReturn(new EntityCollection());

        $stageRepo = $this->createMock(RDBRepository::class);
        $stageRepo->method('where')->willReturn($emptyBuilder);
        $oppRepo = $this->createMock(RDBRepository::class);
        $oppRepo->method('where')->willReturn($emptyBuilder);
        $taskRepo = $this->createMock(RDBRepository::class);
        $taskRepo->method('where')->willReturn($emptyBuilder);

        $heldActivity = function (string $id): Entity {
            $activity = $this->createMock(Entity::class);
            $activity->method('getId')->willReturn($id);
            $activity->method('get')->willReturnCallback(fn (string $name) => match ($name) {
                'status' => 'Held',
                'dateStart' => '2026-11-20 10:00:00',
                'createdAt' => '2026-11-20 10:00:00',
                'assignedUserId' => 'user-1',
                'teamsIds' => ['team-a'],
                default => null,
            });
            return $activity;
        };

        $heldQueries = [];
        $activityRepo = function (string $entityType) use ($heldActivity, &$heldQueries): RDBRepository {
            $builder = $this->createMock(RDBSelectBuilder::class);
            $builder->method('find')->willReturn(new EntityCollection([$heldActivity($entityType . '-1')]));
            $repo = $this->createMock(RDBRepository::class);
            $repo->expects($this->once())->method('where')->with(['status' => 'Held'])
                ->willReturnCallback(function (array $where) use (&$heldQueries, $entityType, $builder): RDBSelectBuilder {
                    $heldQueries[$entityType] = $where;
                    return $builder;
                });
            return $repo;
        };

        $goal = $this->createMock(Entity::class);
        $goal->method('getId')->willReturn('team-goal-1');
        $goal->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'name' => 'هدف فعالیت تیم',
            'metricType' => 'activitiesHeld',
            'scopeType' => 'team',
            'teamId' => 'team-a',
            'targetValue' => 2.0,
            'assignedUserId' => null,
            'dateStart' => null,
            'dateEnd' => null,
            default => null,
        });
        $deniedGoal = $this->createMock(Entity::class);
        $deniedGoal->method('getId')->willReturn('denied-user-goal');
        $deniedGoal->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'dateStart' => null,
            'dateEnd' => null,
            default => null,
        });
        $goalBuilder = $this->createMock(RDBSelectBuilder::class);
        $goalBuilder->method('find')->willReturnOnConsecutiveCalls(new EntityCollection([$deniedGoal]), new EntityCollection([$goal]), new EntityCollection());
        $goalQueries = [];
        $goalRepo = $this->createMock(RDBRepository::class);
        $goalRepo->method('where')->willReturnCallback(function (array $where) use (&$goalQueries, $goalBuilder): RDBSelectBuilder {
            $goalQueries[] = $where;
            return $goalBuilder;
        });

        $repositoryAccesses = [];
        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->willReturnCallback(function (string $entityType) use ($stageRepo, $oppRepo, $taskRepo, $activityRepo, $goalRepo, &$repositoryAccesses): RDBRepository {
            $repositoryAccesses[] = $entityType;
            return match ($entityType) {
                'PipelineStage' => $stageRepo,
                'Opportunity' => $oppRepo,
                'Task' => $taskRepo,
                'Call' => $activityRepo('Call'),
                'Meeting' => $activityRepo('Meeting'),
                'BidarGoal' => $goalRepo,
                default => throw new \RuntimeException('Unexpected repository access: ' . $entityType),
            };
        });

        $acl = $this->createMock(Acl::class);
        $acl->method('check')->with('Opportunity', 'read')->willReturn(true);
        $acl->method('checkScope')->willReturn(true);
        $acl->method('checkEntityRead')->willReturnCallback(fn (Entity $candidate): bool => $candidate === $goal);

        $user = $this->createMock(User::class);
        $user->method('isAdmin')->willReturn(false);
        $user->method('getId')->willReturn('user-1');
        $user->method('getTeamIdList')->willReturn(['team-a']);

        $action = new GetDashboardSummary($this->service, $em, $acl, null, null, $user);
        $response = $action->process($this->createMock(Request::class));
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame(['PipelineStage', 'Opportunity', 'Task', 'Call', 'Meeting', 'BidarGoal'], $repositoryAccesses);
        $this->assertSame(['status' => 'Held'], $heldQueries['Call']);
        $this->assertSame(['status' => 'Held'], $heldQueries['Meeting']);
        $this->assertContains(['scopeType' => 'team', 'teamId' => ['team-a']], $goalQueries);
        $this->assertSame(0, $data['overdueActivitiesCount']);
        $this->assertSame('team-goal-1', $data['goal']['id']);
        $this->assertSame(2.0, (float) $data['goal']['currentValue']);
        $this->assertSame(100.0, (float) $data['goal']['progressPercent']);
    }
}
