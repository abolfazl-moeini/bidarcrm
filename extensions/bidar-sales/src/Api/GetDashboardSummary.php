<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Api;

use Espo\Modules\BidarSales\Services\DashboardSummaryService;

class GetDashboardSummary
{
    private DashboardSummaryService $service;

    public function __construct(?DashboardSummaryService $service = null)
    {
        $this->service = $service ?? new DashboardSummaryService();
    }

    public function getService(): DashboardSummaryService
    {
        return $this->service;
    }
}
