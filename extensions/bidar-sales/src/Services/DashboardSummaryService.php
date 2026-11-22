<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Services;

class DashboardSummaryService
{
    /**
     * @param list<array<string, mixed>> $deals
     * @param list<array<string, mixed>> $activities
     * @param list<array<string, mixed>> $stages
     * @return array<string, mixed>
     */
    public function calculateSummary(array $deals, array $activities, array $stages): array
    {
        $openCount = 0;
        $openAmount = 0.0;
        $wonCount = 0;
        $wonAmount = 0.0;
        $rottenCount = 0;

        $stageMetrics = [];
        foreach ($stages as $stage) {
            $stageKey = (string) ($stage['name'] ?? $stage['id'] ?? '');
            $stageMetrics[$stageKey] = [
                'id' => (string) ($stage['id'] ?? $stageKey),
                'name' => (string) ($stage['name'] ?? $stageKey),
                'count' => 0,
                'amount' => 0.0,
            ];
        }

        foreach ($deals as $deal) {
            $amount = (float) ($deal['amount'] ?? 0);
            $stageProbability = $deal['stageProbability'] ?? '';
            $stage = (string) ($deal['stage'] ?? '');
            $isRotten = (bool) ($deal['isRotten'] ?? false);

            if ($stageProbability === 'Closed Won') {
                $wonCount++;
                $wonAmount += $amount;
            } elseif ($stageProbability !== 'Closed Lost') {
                $openCount++;
                $openAmount += $amount;
                if ($isRotten) {
                    $rottenCount++;
                }

                if (isset($stageMetrics[$stage])) {
                    $stageMetrics[$stage]['count']++;
                    $stageMetrics[$stage]['amount'] += $amount;
                }
            }
        }

        $overdueActivitiesCount = 0;
        foreach ($activities as $act) {
            if (($act['status'] ?? '') === 'Planned' && !empty($act['isOverdue'])) {
                $overdueActivitiesCount++;
            }
        }

        return [
            'openCount' => $openCount,
            'openAmount' => $openAmount,
            'wonCount' => $wonCount,
            'wonAmount' => $wonAmount,
            'rottenCount' => $rottenCount,
            'overdueActivitiesCount' => $overdueActivitiesCount,
            'funnelStages' => array_values($stageMetrics),
        ];
    }
}
