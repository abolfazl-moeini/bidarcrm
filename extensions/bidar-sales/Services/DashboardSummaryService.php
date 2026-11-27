<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Services;

use DateTimeImmutable;

class DashboardSummaryService
{
    private const LOSS_REASON_LABELS = [
        'PriceTooHigh' => 'قیمت بالا',
        'Competitor' => 'انتخاب رقیب',
        'NoBudget' => 'نبود بودجه',
        'NoResponse' => 'عدم پاسخگویی',
        'NotQualified' => 'نبود نیاز واقعی',
        'Other' => 'سایر',
    ];

    /**
     * @param list<array<string, mixed>> $deals
     * @param list<array<string, mixed>> $activities
     * @param list<array<string, mixed>> $stages
     * @param ?array<string, mixed> $goal
     * @return array<string, mixed>
     */
    public function calculateSummary(array $deals, array $activities, array $stages, ?array $goal = null): array
    {
        $openCount = 0;
        $openAmount = 0.0;
        $wonCount = 0;
        $wonAmount = 0.0;
        $lostCount = 0;
        $rottenCount = 0;

        $stageMetrics = [];
        $stageLookup = [];
        $stageById = [];
        foreach ($stages as $stage) {
            $stageId = (string) ($stage['id'] ?? '');
            $stageName = (string) ($stage['name'] ?? $stageId);
            $stageKey = $stageId !== '' ? $stageId : $stageName;
            $stageCode = isset($stage['code']) && is_string($stage['code']) ? $stage['code'] : '';
            $stageColor = isset($stage['color']) && is_string($stage['color']) ? $stage['color'] : null;
            $mappedStatus = isset($stage['mappedStatus']) && is_string($stage['mappedStatus']) ? $stage['mappedStatus'] : null;

            $stageMetrics[$stageKey] = [
                'stageId' => $stageId,
                'stageName' => $stageName,
                'count' => 0,
                'amount' => 0.0,
                'color' => $stageColor,
                'id' => $stageId,
                'name' => $stageName,
                'mappedStatus' => $mappedStatus,
            ];

            if ($stageId !== '') {
                $stageLookup[$stageId] = $stageKey;
                $stageById[$stageId] = $stage;
            }
            if ($stageName !== '') {
                if (!isset($stageLookup[$stageName])) {
                    $stageLookup[$stageName] = $stageKey;
                }
            }
            if ($stageCode !== '') {
                if (!isset($stageLookup[$stageCode])) {
                    $stageLookup[$stageCode] = $stageKey;
                }
            }
            $stageLookup[$stageKey] = $stageKey;
        }

        $salesCycles = [];
        $lossReasonsMap = [];
        $salesRepsMap = [];
        $leadSourcesMap = [];

        foreach ($deals as $deal) {
            $amount = (float) ($deal['amount'] ?? 0);
            $probability = $deal['probability'] ?? null;
            $stage = (string) ($deal['stage'] ?? '');
            $pipelineStageId = (string) ($deal['pipelineStageId'] ?? $deal['stageId'] ?? '');
            $isRotten = (bool) ($deal['isRotten'] ?? false);

            $stageObj = $pipelineStageId !== '' ? ($stageById[$pipelineStageId] ?? null) : null;
            $stageMappedStatus = isset($stageObj['mappedStatus']) ? (string) $stageObj['mappedStatus'] : null;

            $isWon = $this->isDealWon($deal, $stageObj, $stages);
            $isLost = $this->isDealLost($deal, $stageObj, $stages);

            if ($isWon) {
                $wonCount++;
                $wonAmount += $amount;

                // avgSalesCycleDays calculation
                if (isset($deal['salesCycleDays'])) {
                    $salesCycles[] = max(0.0, (float) $deal['salesCycleDays']);
                } elseif (!empty($deal['createdAt']) && !empty($deal['closeDate'])) {
                    try {
                        $created = new DateTimeImmutable(substr((string) $deal['createdAt'], 0, 10));
                        $closed = new DateTimeImmutable(substr((string) $deal['closeDate'], 0, 10));
                        $diff = $created->diff($closed);
                        $salesCycles[] = $diff->invert ? 0.0 : (float) $diff->days;
                    } catch (\Throwable) {
                        // ignore malformed dates
                    }
                }
            } elseif ($isLost) {
                $lostCount++;

                $reason = (string) ($deal['lossReason'] ?? 'Other');
                if ($reason === '') {
                    $reason = 'Other';
                }
                $label = (string) ($deal['lossReasonLabel'] ?? self::LOSS_REASON_LABELS[$reason] ?? $reason);

                if (!isset($lossReasonsMap[$reason])) {
                    $lossReasonsMap[$reason] = [
                        'reason' => $reason,
                        'label' => $label,
                        'count' => 0,
                        'amount' => 0.0,
                    ];
                }
                $lossReasonsMap[$reason]['count']++;
                $lossReasonsMap[$reason]['amount'] += $amount;
            } else {
                $openCount++;
                $openAmount += $amount;
                if ($isRotten) {
                    $rottenCount++;
                }

                $matchedStageKey = null;
                if ($pipelineStageId !== '' && isset($stageLookup[$pipelineStageId])) {
                    $matchedStageKey = $stageLookup[$pipelineStageId];
                }
                if ($matchedStageKey === null && $stage !== '') {
                    $matchedStageKey = $stageLookup[$stage] ?? (isset($stageMetrics[$stage]) ? $stage : null);
                }
                if ($matchedStageKey === null && $stageMappedStatus !== null && isset($stageLookup[$stageMappedStatus])) {
                    $matchedStageKey = $stageLookup[$stageMappedStatus];
                }
                if ($matchedStageKey === null) {
                    $dealStageId = (string) ($deal['stageId'] ?? '');
                    $dealStageName = (string) ($deal['stageName'] ?? '');
                    if ($dealStageId !== '' && isset($stageLookup[$dealStageId])) {
                        $matchedStageKey = $stageLookup[$dealStageId];
                    } elseif ($dealStageName !== '' && isset($stageLookup[$dealStageName])) {
                        $matchedStageKey = $stageLookup[$dealStageName];
                    }
                }

                if ($matchedStageKey !== null && isset($stageMetrics[$matchedStageKey])) {
                    $stageMetrics[$matchedStageKey]['count']++;
                    $stageMetrics[$matchedStageKey]['amount'] += $amount;
                }
            }

            // topSalesReps aggregation
            $userId = (string) ($deal['assignedUserId'] ?? $deal['userId'] ?? '');
            if ($userId !== '') {
                $userName = (string) ($deal['assignedUserName'] ?? $deal['userName'] ?? $userId);
                if (!isset($salesRepsMap[$userId])) {
                    $salesRepsMap[$userId] = [
                        'userId' => $userId,
                        'userName' => $userName,
                        'wonCount' => 0,
                        'wonAmount' => 0.0,
                        'openCount' => 0,
                        'rottenCount' => 0,
                    ];
                }

                if ($isWon) {
                    $salesRepsMap[$userId]['wonCount']++;
                    $salesRepsMap[$userId]['wonAmount'] += $amount;
                } elseif (!$isLost) {
                    $salesRepsMap[$userId]['openCount']++;
                    if ($isRotten) {
                        $salesRepsMap[$userId]['rottenCount']++;
                    }
                }
            }

            // leadSourceBreakdown aggregation
            $source = (string) ($deal['source'] ?? $deal['leadSource'] ?? '');
            if ($source === '') {
                $source = 'سایر';
            }
            if (!isset($leadSourcesMap[$source])) {
                $leadSourcesMap[$source] = [
                    'source' => $source,
                    'count' => 0,
                    'wonCount' => 0,
                    'wonAmount' => 0.0,
                ];
            }
            $leadSourcesMap[$source]['count']++;
            if ($isWon) {
                $leadSourcesMap[$source]['wonCount']++;
                $leadSourcesMap[$source]['wonAmount'] += $amount;
            }
        }

        $overdueActivitiesCount = 0;
        $overdueStatuses = ['Not Started', 'Started', 'Planned'];
        foreach ($activities as $act) {
            $status = (string) ($act['status'] ?? '');
            if (in_array($status, $overdueStatuses, true) && !empty($act['isOverdue'])) {
                $overdueActivitiesCount++;
            }
        }

        // 1. conversionRate: round((wonCount / max(1, wonCount + lostCount)) * 100, 1), 0.0 if wonCount + lostCount == 0
        $totalClosed = $wonCount + $lostCount;
        $conversionRate = $totalClosed > 0
            ? round(($wonCount / $totalClosed) * 100.0, 1)
            : 0.0;

        // 2. avgSalesCycleDays
        $avgSalesCycleDays = count($salesCycles) > 0
            ? round(array_sum($salesCycles) / count($salesCycles), 1)
            : 0.0;

        // 3. lossReasonsBreakdown: sorted descending by count
        $lossReasonsBreakdown = array_values($lossReasonsMap);
        usort($lossReasonsBreakdown, function ($a, $b) {
            return ($b['count'] <=> $a['count']) ?: ($b['amount'] <=> $a['amount']);
        });

        // 4. topSalesReps: sorted descending by wonAmount
        $topSalesReps = array_values($salesRepsMap);
        usort($topSalesReps, function ($a, $b) {
            return ($b['wonAmount'] <=> $a['wonAmount']) ?: ($b['wonCount'] <=> $a['wonCount']);
        });

        // 5. leadSourceBreakdown
        $leadSourceBreakdown = array_values($leadSourcesMap);
        usort($leadSourceBreakdown, function ($a, $b) {
            return ($b['count'] <=> $a['count']) ?: ($b['wonAmount'] <=> $a['wonAmount']);
        });

        $goalResult = null;
        if ($goal !== null) {
            $goalProgress = $this->calculateGoalProgress($goal, [
                'deals' => $deals,
                'activities' => $activities,
                'stages' => $stages,
            ]);
            $goalProgress['targetAmount'] = $goalProgress['targetValue'];
            $goalProgress['currentAmount'] = $goalProgress['currentValue'];
            $goalProgress['percent'] = $goalProgress['progressPercent'];
            $goalResult = $goalProgress;
        }

        return [
            'openCount' => $openCount,
            'openAmount' => $openAmount,
            'wonCount' => $wonCount,
            'wonAmount' => $wonAmount,
            'lostCount' => $lostCount,
            'rottenCount' => $rottenCount,
            'overdueActivitiesCount' => $overdueActivitiesCount,
            'funnelStages' => array_values($stageMetrics),
            'conversionRate' => $conversionRate,
            'avgSalesCycleDays' => $avgSalesCycleDays,
            'lossReasonsBreakdown' => $lossReasonsBreakdown,
            'topSalesReps' => $topSalesReps,
            'leadSourceBreakdown' => $leadSourceBreakdown,
            'goal' => $goalResult,
        ];
    }

    /**
     * Calculate progress for a sales goal.
     *
     * @param array<string, mixed> $goal
     * @param ?array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function calculateGoalProgress(array $goal, ?array $filters = null): array
    {
        $targetValue = (float) ($goal['targetValue'] ?? 0.0);
        $metricType = (string) ($goal['metricType'] ?? 'wonAmount');
        $scopeType = (string) ($goal['scopeType'] ?? 'all');
        $assignedUserId = isset($goal['assignedUserId']) ? (string) $goal['assignedUserId'] : null;
        $teamId = isset($goal['teamId']) ? (string) $goal['teamId'] : null;
        $dateStart = isset($goal['dateStart']) && $goal['dateStart'] !== ''
            ? (string) $goal['dateStart']
            : (isset($goal['startDate']) && $goal['startDate'] !== '' ? (string) $goal['startDate'] : null);
        $dateEnd = isset($goal['dateEnd']) && $goal['dateEnd'] !== ''
            ? (string) $goal['dateEnd']
            : (isset($goal['endDate']) && $goal['endDate'] !== '' ? (string) $goal['endDate'] : null);

        if (isset($filters['currentValue'])) {
            $currentValue = (float) $filters['currentValue'];
        } else {
            $currentValue = 0.0;
            $deals = $filters['deals'] ?? (isset($filters[0]) && is_array($filters[0]) ? $filters : []);
            $activities = $filters['activities'] ?? [];

            if ($metricType === 'activitiesHeld') {
                foreach ($activities as $act) {
                    if (($act['status'] ?? '') === 'Held') {
                        if ($scopeType === 'user' && $assignedUserId !== null) {
                            $actUserId = (string) ($act['assignedUserId'] ?? $act['userId'] ?? '');
                            if ($actUserId !== $assignedUserId) {
                                continue;
                            }
                        } elseif ($scopeType === 'team' && $teamId !== null) {
                            $actTeamIds = is_array($act['teamIds'] ?? null) ? $act['teamIds'] : [];
                            if (($act['teamId'] ?? null) !== $teamId && !in_array($teamId, $actTeamIds, true)) {
                                continue;
                            }
                        }

                        if ($dateStart !== null || $dateEnd !== null) {
                            $date = !empty($act['dateStart']) ? (string) $act['dateStart'] : (string) ($act['createdAt'] ?? '');
                            if ($date === '') {
                                continue;
                            }
                            $checkDate = substr($date, 0, 10);
                            if ($dateStart !== null && $checkDate < substr($dateStart, 0, 10)) {
                                continue;
                            }
                            if ($dateEnd !== null && $checkDate > substr($dateEnd, 0, 10)) {
                                continue;
                            }
                        }

                        $currentValue += 1.0;
                    }
                }
            } else {
                $goalStages = $filters['stages'] ?? [];
                foreach ($deals as $deal) {
                    if ($scopeType === 'user' && $assignedUserId !== null) {
                        $dealUserId = (string) ($deal['assignedUserId'] ?? $deal['userId'] ?? '');
                        if ($dealUserId !== $assignedUserId) {
                            continue;
                        }
                    } elseif ($scopeType === 'team' && $teamId !== null) {
                        $dealTeamIds = is_array($deal['teamIds'] ?? null) ? $deal['teamIds'] : [];
                        if (($deal['teamId'] ?? null) !== $teamId && !in_array($teamId, $dealTeamIds, true)) {
                            continue;
                        }
                    }

                    if ($dateStart !== null || $dateEnd !== null) {
                        $date = $metricType === 'dealsCreated'
                            ? (string) ($deal['createdAt'] ?? '')
                            : (!empty($deal['closeDate']) ? (string) $deal['closeDate'] : (string) ($deal['createdAt'] ?? ''));
                        if ($date === '') {
                            continue;
                        }
                        $checkDate = substr($date, 0, 10);
                        if ($dateStart !== null && $checkDate < substr($dateStart, 0, 10)) {
                            continue;
                        }
                        if ($dateEnd !== null && $checkDate > substr($dateEnd, 0, 10)) {
                            continue;
                        }
                    }

                    $isDealWon = $this->isDealWon($deal, null, $goalStages);

                    if ($metricType === 'wonAmount') {
                        if ($isDealWon) {
                            $currentValue += (float) ($deal['amount'] ?? 0.0);
                        }
                    } elseif ($metricType === 'wonCount') {
                        if ($isDealWon) {
                            $currentValue += 1.0;
                        }
                    } elseif ($metricType === 'dealsCreated') {
                        $currentValue += 1.0;
                    }
                }
            }
        }

        $progressPercent = $targetValue > 0.0
            ? round(($currentValue / $targetValue) * 100.0, 1)
            : 0.0;

        return [
            'id' => $goal['id'] ?? null,
            'name' => $goal['name'] ?? '',
            'metricType' => $metricType,
            'scopeType' => $scopeType,
            'targetValue' => $targetValue,
            'currentValue' => $currentValue,
            'progressPercent' => $progressPercent,
        ];
    }

    /**
     * Determines whether a deal is considered "Closed Won".
     *
     * @param array<string, mixed> $deal
     * @param ?array<string, mixed> $stageObj
     * @param list<array<string, mixed>> $stages
     * @return bool
     */
    private const OPEN_STANDARD_STAGES = [
        'Prospecting',
        'Qualification',
        'Needs Analysis',
        'Value Proposition',
        'Id. Decision Makers',
        'Perception Analysis',
        'Proposal',
        'Proposal/Price Quote',
        'Negotiation',
        'Negotiation/Review',
    ];

    public function isDealWon(array $deal, ?array $stageObj = null, array $stages = []): bool
    {
        $probability = $deal['probability'] ?? $deal['stageProbability'] ?? null;
        $stage = (string) ($deal['stage'] ?? '');
        $stageMappedStatus = isset($stageObj['mappedStatus']) ? (string) $stageObj['mappedStatus'] : null;

        if ($stageMappedStatus === null && !empty($stages)) {
            $pipelineStageId = (string) ($deal['pipelineStageId'] ?? $deal['stageId'] ?? '');
            foreach ($stages as $st) {
                $stId = (string) ($st['id'] ?? '');
                $stName = (string) ($st['name'] ?? '');
                if (($pipelineStageId !== '' && $stId === $pipelineStageId) || ($stage !== '' && $stName === $stage)) {
                    $stageMappedStatus = isset($st['mappedStatus']) ? (string) $st['mappedStatus'] : null;
                    break;
                }
            }
        }
        if ($stageMappedStatus === null && isset($deal['mappedStatus'])) {
            $stageMappedStatus = (string) $deal['mappedStatus'];
        }

        if ($stage === 'Closed Won' || $stageMappedStatus === 'Closed Won') {
            return true;
        }

        $isExplicitOpen = ($stageMappedStatus !== null && $stageMappedStatus !== '' && $stageMappedStatus !== 'Closed Won')
            || in_array($stage, self::OPEN_STANDARD_STAGES, true);

        $is100 = ($probability === 100 || $probability === '100' || (is_numeric($probability) && (int) $probability === 100));
        if ($is100 && !$isExplicitOpen && $stage !== 'Closed Lost' && $stageMappedStatus !== 'Closed Lost') {
            return true;
        }

        if (($deal['stageProbability'] ?? null) === 'Closed Won' || ($deal['probability'] ?? null) === 'Closed Won') {
            return true;
        }

        return false;
    }

    /**
     * Determines whether a deal is considered "Closed Lost".
     *
     * @param array<string, mixed> $deal
     * @param ?array<string, mixed> $stageObj
     * @param list<array<string, mixed>> $stages
     * @return bool
     */
    public function isDealLost(array $deal, ?array $stageObj = null, array $stages = []): bool
    {
        if ($this->isDealWon($deal, $stageObj, $stages)) {
            return false;
        }

        $stage = (string) ($deal['stage'] ?? '');
        $stageMappedStatus = isset($stageObj['mappedStatus']) ? (string) $stageObj['mappedStatus'] : null;

        if ($stageMappedStatus === null && !empty($stages)) {
            $pipelineStageId = (string) ($deal['pipelineStageId'] ?? $deal['stageId'] ?? '');
            foreach ($stages as $st) {
                $stId = (string) ($st['id'] ?? '');
                $stName = (string) ($st['name'] ?? '');
                if (($pipelineStageId !== '' && $stId === $pipelineStageId) || ($stage !== '' && $stName === $stage)) {
                    $stageMappedStatus = isset($st['mappedStatus']) ? (string) $st['mappedStatus'] : null;
                    break;
                }
            }
        }
        if ($stageMappedStatus === null && isset($deal['mappedStatus'])) {
            $stageMappedStatus = (string) $deal['mappedStatus'];
        }

        if ($stage === 'Closed Lost' || $stageMappedStatus === 'Closed Lost') {
            return true;
        }

        if (($deal['stageProbability'] ?? null) === 'Closed Lost' || ($deal['probability'] ?? null) === 'Closed Lost') {
            return true;
        }

        return false;
    }
}
