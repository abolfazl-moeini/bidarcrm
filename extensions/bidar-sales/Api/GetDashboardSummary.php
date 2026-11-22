<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Api;

use Espo\Core\Acl;
use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Modules\BidarSales\Services\DashboardSummaryService;
use Espo\ORM\EntityManager;

class GetDashboardSummary implements Action
{
    private DashboardSummaryService $service;
    private ?EntityManager $entityManager;
    private ?Acl $acl;

    public function __construct(
        ?DashboardSummaryService $service = null,
        ?EntityManager $entityManager = null,
        ?Acl $acl = null
    ) {
        $this->service = $service ?? new DashboardSummaryService();
        $this->entityManager = $entityManager;
        $this->acl = $acl;
    }

    public function getService(): DashboardSummaryService
    {
        return $this->service;
    }

    /**
     * Helper calculation method for unit tests.
     *
     * @param list<array<string, mixed>> $deals
     * @param list<array<string, mixed>> $activities
     * @param list<array<string, mixed>> $stages
     * @return array<string, mixed>
     */
    public function calculate(array $deals, array $activities, array $stages): array
    {
        return $this->service->calculateSummary($deals, $activities, $stages);
    }

    public function process(Request $request): Response
    {
        $deals = [];
        $activities = [];
        $stages = [];

        if ($this->entityManager !== null) {
            $pipelineId = $request->getQueryParam('pipelineId');

            $stageWhere = [];
            if (!empty($pipelineId)) {
                $stageWhere['pipelineId'] = $pipelineId;
            }

            $stageCollection = $this->entityManager->getRDBRepository('PipelineStage')
                ->where($stageWhere)
                ->order('order')
                ->find();

            foreach ($stageCollection as $st) {
                $stages[] = [
                    'id' => $st->getId(),
                    'name' => $st->get('name'),
                    'probability' => $st->get('probability'),
                    'rottenDays' => $st->get('rottenDays'),
                ];
            }

            $oppQuery = $this->entityManager->getRDBRepository('Opportunity');
            $oppWhere = [];
            if (!empty($pipelineId)) {
                $oppWhere['pipelineId'] = $pipelineId;
            }

            $dealCollection = $oppQuery->where($oppWhere)->find();
            foreach ($dealCollection as $opp) {
                $deals[] = [
                    'id' => $opp->getId(),
                    'amount' => $opp->get('amountConverted') ?? $opp->get('amount') ?? 0,
                    'stage' => $opp->get('stage'),
                    'stageProbability' => $opp->get('stageProbability'),
                    'isRotten' => (bool) $opp->get('isRotten'),
                ];
            }

            $taskCollection = $this->entityManager->getRDBRepository('Task')
                ->where([
                    'status' => 'Planned',
                ])
                ->find();

            $now = new \DateTimeImmutable('now');
            foreach ($taskCollection as $task) {
                $dateEnd = $task->get('dateEnd') ?? $task->get('dateDue');
                $isOverdue = false;
                if ($dateEnd) {
                    $isOverdue = new \DateTimeImmutable((string) $dateEnd) < $now;
                }
                $activities[] = [
                    'status' => $task->get('status'),
                    'isOverdue' => $isOverdue,
                ];
            }
        }

        $result = $this->service->calculateSummary($deals, $activities, $stages);

        return ResponseComposer::json($result);
    }
}
