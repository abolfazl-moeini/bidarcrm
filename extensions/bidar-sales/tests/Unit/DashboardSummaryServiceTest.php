<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Modules\BidarSales\Api\GetDashboardSummary;
use Espo\Modules\BidarSales\Services\DashboardSummaryService;
use PHPUnit\Framework\TestCase;

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
            ['id' => 's-1', 'name' => 'Initial Contact', 'color' => '#6366f1'],
            ['id' => 's-2', 'name' => 'Negotiation', 'color' => '#3b82f6'],
            ['id' => 's-3', 'name' => 'Closed Won', 'color' => '#10b981'],
        ];

        $summary = $this->service->calculateSummary($deals, $activities, $stages);

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
    }
}
