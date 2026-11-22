<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarSales\Services\DashboardSummaryService;

class DashboardSummaryServiceTest extends TestCase
{
    private DashboardSummaryService $service;

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
                $this->assertSame('Espo\\Modules\\BidarSales\\Api\\GetDashboardSummary', $route['action'] ?? null);
            }
        }
        $this->assertTrue($found, 'GET /BidarDashboard/summary route must be registered');
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
            ],
            [
                'id' => 'deal-2',
                'amount' => 25000000,
                'stage' => 'Negotiation',
                'stageProbability' => 'In Progress',
                'isRotten' => false,
            ],
            [
                'id' => 'deal-3',
                'amount' => 50000000,
                'stage' => 'Closed Won',
                'stageProbability' => 'Closed Won',
                'isRotten' => false,
            ],
        ];

        $activities = [
            ['id' => 'act-1', 'status' => 'Planned', 'isOverdue' => true],
            ['id' => 'act-2', 'status' => 'Planned', 'isOverdue' => false],
            ['id' => 'act-3', 'status' => 'Held', 'isOverdue' => false],
        ];

        $stages = [
            ['id' => 's-1', 'name' => 'Initial Contact'],
            ['id' => 's-2', 'name' => 'Negotiation'],
            ['id' => 's-3', 'name' => 'Closed Won'],
        ];

        $summary = $this->service->calculateSummary($deals, $activities, $stages);

        $this->assertSame(2, $summary['openCount']);
        $this->assertSame(35000000.0, (float) $summary['openAmount']);
        $this->assertSame(1, $summary['wonCount']);
        $this->assertSame(50000000.0, (float) $summary['wonAmount']);
        $this->assertSame(1, $summary['rottenCount']);
        $this->assertSame(1, $summary['overdueActivitiesCount']);
        $this->assertCount(3, $summary['funnelStages']);
    }
}
