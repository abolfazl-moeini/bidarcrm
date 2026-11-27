<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Api;

use DateTimeImmutable;
use DateTimeZone;
use Espo\Core\Acl;
use Espo\Core\Acl\Table;
use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Container;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\InjectableFactory;
use Espo\Core\Select\SelectBuilderFactory;
use Espo\Entities\User;
use Espo\Modules\BidarIran\Support\JalaliHelper;
use Espo\Modules\BidarSales\Services\DashboardSummaryService;
use Espo\ORM\EntityManager;
use Morilog\Jalali\Jalalian;

class GetDashboardSummary implements Action
{
    private DashboardSummaryService $service;
    private ?EntityManager $entityManager;
    private ?Acl $acl;
    private ?Container $container;
    private ?SelectBuilderFactory $selectBuilderFactory;
    private ?InjectableFactory $injectableFactory;
    private ?User $user;

    public function __construct(
        ?DashboardSummaryService $service = null,
        ?EntityManager $entityManager = null,
        ?Acl $acl = null,
        ?Container $container = null,
        ?SelectBuilderFactory $selectBuilderFactory = null,
        ?User $user = null,
        ?InjectableFactory $injectableFactory = null
    ) {
        $this->service = $service ?? new DashboardSummaryService();
        $this->entityManager = $entityManager;
        $this->acl = $acl;
        $this->container = $container;
        $this->selectBuilderFactory = $selectBuilderFactory;
        $this->injectableFactory = $injectableFactory;
        $this->user = $user;
    }

    public function getContainer(): ?Container
    {
        return $this->container;
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

    /**
     * Resolve date range from jalaliPeriod if requested.
     *
     * @return array{dateFrom: ?string, dateTo: ?string}
     */
    public function resolveJalaliPeriod(?string $period, ?DateTimeImmutable $now = null, bool $toUtc = false): array
    {
        if (empty($period)) {
            return ['dateFrom' => null, 'dateTo' => null];
        }

        try {
            $tz = new DateTimeZone('Asia/Tehran');
            $nowTehran = $now !== null ? $now->setTimezone($tz) : new DateTimeImmutable('now', $tz);
            $jNow = Jalalian::fromDateTime($nowTehran);

            $range = match ($period) {
                'current_month' => JalaliHelper::getJalaliMonthRange($jNow->getYear(), $jNow->getMonth()),
                'last_month' => (function () use ($jNow): array {
                    $lastYear = $jNow->getYear();
                    $lastMonth = $jNow->getMonth() - 1;
                    if ($lastMonth < 1) {
                        $lastMonth = 12;
                        $lastYear--;
                    }
                    return JalaliHelper::getJalaliMonthRange($lastYear, $lastMonth);
                })(),
                'current_quarter' => JalaliHelper::getJalaliQuarterRange((int) ceil($jNow->getMonth() / 3), $jNow->getYear()),
                default => null,
            };

            if ($range === null) {
                return ['dateFrom' => null, 'dateTo' => null];
            }

            $start = $range['start'];
            $end = $range['end'];

            if ($toUtc) {
                $utcTz = new DateTimeZone('UTC');
                $start = (new DateTimeImmutable($start, $tz))->setTimezone($utcTz)->format('Y-m-d H:i:s');
                $end = (new DateTimeImmutable($end, $tz))->setTimezone($utcTz)->format('Y-m-d H:i:s');
            }

            return ['dateFrom' => $start, 'dateTo' => $end];
        } catch (\Throwable) {
            return ['dateFrom' => null, 'dateTo' => null];
        }
    }

    public static function normalizeDateToBoundary(?string $dateTo): ?string
    {
        if ($dateTo === null) {
            return null;
        }
        $trimmed = trim($dateTo);
        if ($trimmed === '') {
            return null;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed . ' 23:59:59';
        }
        return $trimmed;
    }

    public function process(Request $request): Response
    {
        $container = $this->container ?? (method_exists($this, 'getContainer') ? $this->getContainer() : null);

        $acl = $this->acl;
        if ($acl === null && $container !== null && $container->has('acl')) {
            $acl = $container->get('acl');
        } elseif ($acl === null && method_exists($this, 'getContainer') && $this->getContainer() !== null) {
            $c = $this->getContainer();
            if ($c->has('acl')) {
                $acl = $c->get('acl');
            }
        }

        if ($acl && !$acl->check('Opportunity', 'read')) {
            throw new Forbidden("Access denied to Opportunity data.");
        }

        $user = $this->user;
        if ($user === null && $container !== null && $container->has('user')) {
            $user = $container->get('user');
        }

        $selectBuilderFactory = $this->selectBuilderFactory;
        if ($selectBuilderFactory === null && $container !== null) {
            if ($container->has('selectBuilderFactory')) {
                $selectBuilderFactory = $container->get('selectBuilderFactory');
            } elseif ($container->has(SelectBuilderFactory::class)) {
                $selectBuilderFactory = $container->get(SelectBuilderFactory::class);
            }
        }
        if ($selectBuilderFactory === null && $this->injectableFactory !== null) {
            $createdFactory = $this->injectableFactory->create(SelectBuilderFactory::class);
            $selectBuilderFactory = $createdFactory instanceof SelectBuilderFactory ? $createdFactory : null;
        }

        $deals = [];
        $activities = [];
        $stages = [];
        $goalData = null;

        if ($this->entityManager !== null) {
            if ($acl === null) {
                throw new Forbidden("Access denied to dashboard data.");
            }
            $pipelineId = $request->getQueryParam('pipelineId');
            $assignedUserId = $request->getQueryParam('assignedUserId');
            $dateFromRaw = $request->getQueryParam('dateFrom');
            $dateToRaw = $request->getQueryParam('dateTo');
            $jalaliPeriod = $request->getQueryParam('jalaliPeriod');

            $dateFrom = ($dateFromRaw !== null && trim((string) $dateFromRaw) !== '') ? trim((string) $dateFromRaw) : null;
            $dateTo = self::normalizeDateToBoundary($dateToRaw !== null ? (string) $dateToRaw : null);

            if (!empty($jalaliPeriod)) {
                $periodRange = $this->resolveJalaliPeriod((string) $jalaliPeriod, null, true);
                $dateFrom = $dateFrom ?? $periodRange['dateFrom'];
                $dateTo = $dateTo ?? $periodRange['dateTo'];
            }

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
                    'mappedStatus' => $st->get('mappedStatus'),
                    'color' => $st->get('color'),
                ];
            }

            $oppQuery = $this->entityManager->getRDBRepository('Opportunity');
            $oppWhere = [];
            if (!empty($pipelineId)) {
                $oppWhere['pipelineId'] = $pipelineId;
            }
            if (!empty($assignedUserId)) {
                $oppWhere['assignedUserId'] = $assignedUserId;
            }
            if (!empty($dateFrom)) {
                $oppWhere['createdAt>='] = $dateFrom;
            }
            if (!empty($dateTo)) {
                $oppWhere['createdAt<='] = $dateTo;
            }

            $dealCollection = null;
            if ($selectBuilderFactory !== null) {
                $builder = $selectBuilderFactory->create()
                    ->from('Opportunity')
                    ->withStrictAccessControl();
                $query = $builder->build();
                $dealCollection = $oppQuery->clone($query)->where($oppWhere)->find();
            } else {
                if ($user !== null && !$user->isAdmin() && $acl !== null) {
                    $level = method_exists($acl, 'getLevel')
                        ? $acl->getLevel('Opportunity', 'read')
                        : (method_exists($acl, 'getPermissionLevel') ? $acl->getPermissionLevel('Opportunity') : 'all');
                    if ($level === 'own' && empty($oppWhere['assignedUserId'])) {
                        $oppWhere['assignedUserId'] = $user->getId();
                    } elseif ($level === 'no') {
                        throw new Forbidden("Access denied to Opportunity data.");
                    }
                } elseif ($user !== null && !$user->isAdmin() && $acl === null) {
                    throw new Forbidden("Access denied to Opportunity data.");
                }
                $dealCollection = $oppQuery->where($oppWhere)->find();
            }

            foreach ($dealCollection as $opp) {
                $teamIds = method_exists($opp, 'getLinkMultipleIdList')
                    ? $opp->getLinkMultipleIdList('teams')
                    : (is_array($opp->get('teamsIds')) ? $opp->get('teamsIds') : []);
                $deals[] = [
                    'id' => $opp->getId(),
                    'amount' => $opp->get('amountConverted') ?? $opp->get('amount') ?? 0,
                    'stage' => $opp->get('stage'),
                    'probability' => $opp->get('probability'),
                    'pipelineStageId' => $opp->get('pipelineStageId'),
                    'isRotten' => (bool) $opp->get('isRotten'),
                    'createdAt' => (string) ($opp->get('createdAt') ?? ''),
                    'closeDate' => (string) ($opp->get('closeDate') ?? ''),
                    'lossReason' => (string) ($opp->get('lossReason') ?? ''),
                    'lossReasonNote' => (string) ($opp->get('lossReasonNote') ?? ''),
                    'assignedUserId' => (string) ($opp->get('assignedUserId') ?? ''),
                    'assignedUserName' => (string) ($opp->get('assignedUserName') ?? ''),
                    'teamIds' => $teamIds,
                    'source' => (string) ($opp->get('source') ?? $opp->get('leadSource') ?? ''),
                ];
            }

            $nowStr = (new DateTimeImmutable('now'))->format('Y-m-d H:i:s');
            $taskCollection = [];
            if (!method_exists($acl, 'checkScope') || $acl->checkScope('Task', 'read')) {
                $taskQuery = $this->entityManager->getRDBRepository('Task');
                $taskWhere = [
                    'status' => ['Not Started', 'Started'],
                    'dateEnd<' => $nowStr,
                ];
                if (!empty($assignedUserId)) {
                    $taskWhere['assignedUserId'] = $assignedUserId;
                }

                if ($selectBuilderFactory !== null) {
                    $builder = $selectBuilderFactory->create()
                        ->from('Task')
                        ->withStrictAccessControl();
                    $query = $builder->build();
                    $taskCollection = $taskQuery->clone($query)->where($taskWhere)->find();
                } else {
                    if ($user !== null && !$user->isAdmin()) {
                        $level = method_exists($acl, 'getLevel')
                            ? $acl->getLevel('Task', 'read')
                            : (method_exists($acl, 'getPermissionLevel') ? $acl->getPermissionLevel('Task') : 'all');
                        if ($level === 'own' && empty($taskWhere['assignedUserId'])) {
                            $taskWhere['assignedUserId'] = $user->getId();
                        } elseif ($level === 'no') {
                            $taskCollection = null;
                        }
                    }
                    if ($taskCollection !== null) {
                        $taskCollection = $taskQuery->where($taskWhere)->find();
                    } else {
                        $taskCollection = [];
                    }
                }
            }

            $now = new DateTimeImmutable('now');
            foreach ($taskCollection as $task) {
                $dateEnd = $task->get('dateEnd') ?? $task->get('dateDue');
                $isOverdue = true;
                if ($dateEnd) {
                    try {
                        $isOverdue = new DateTimeImmutable((string) $dateEnd) < $now;
                    } catch (\Throwable) {}
                }
                $taskTeamIds = method_exists($task, 'getLinkMultipleIdList')
                    ? $task->getLinkMultipleIdList('teams')
                    : (is_array($task->get('teamsIds')) ? $task->get('teamsIds') : []);
                $activities[] = [
                    'status' => $task->get('status'),
                    'isOverdue' => $isOverdue,
                    'assignedUserId' => (string) ($task->get('assignedUserId') ?? ''),
                    'teamIds' => $taskTeamIds,
                ];
            }

            // Load Held Call & Meeting activities for activitiesHeld goals (never counted as overdue)
            foreach (['Call', 'Meeting'] as $actType) {
                if (method_exists($acl, 'checkScope') && !$acl->checkScope($actType, 'read')) {
                    continue;
                }
                try {
                    $actWhere = ['status' => 'Held'];
                    if (!empty($assignedUserId)) {
                        $actWhere['assignedUserId'] = $assignedUserId;
                    }
                    $actRepo = $this->entityManager->getRDBRepository($actType);
                    if ($selectBuilderFactory !== null) {
                        $actQuery = $selectBuilderFactory->create()->from($actType)->withStrictAccessControl()->build();
                        $actCollection = $actRepo->clone($actQuery)->where($actWhere)->find();
                    } else {
                        $actCollection = $actRepo->where($actWhere)->find();
                    }
                    foreach ($actCollection as $act) {
                        $actTeamIds = method_exists($act, 'getLinkMultipleIdList')
                            ? $act->getLinkMultipleIdList('teams')
                            : (is_array($act->get('teamsIds')) ? $act->get('teamsIds') : []);
                        $activities[] = [
                            'status' => 'Held',
                            'isOverdue' => false,
                            'dateStart' => (string) ($act->get('dateStart') ?? $act->get('createdAt') ?? ''),
                            'assignedUserId' => (string) ($act->get('assignedUserId') ?? ''),
                            'teamIds' => $actTeamIds,
                        ];
                    }
                } catch (\Throwable) {
                    // Ignore in minimal mock environments
                }
            }

            // Query active BidarGoal for the current period/user/team (ACL-gated, no unscoped fallback)
            try {
                if (!method_exists($acl, 'checkScope') || $acl->checkScope('BidarGoal', 'read')) {
                    $goalRepo = $this->entityManager->getRDBRepository('BidarGoal');
                    $today = (new DateTimeImmutable('now'))->format('Y-m-d');
                    $targetUserId = ($user !== null && !$user->isAdmin())
                        ? $user->getId()
                        : ($assignedUserId ?: ($user ? $user->getId() : null));

                    $isGoalActive = static function ($cand) use ($today, $acl): bool {
                        if ($acl !== null && method_exists($acl, 'checkEntityRead') && !$acl->checkEntityRead($cand)) {
                            return false;
                        }
                        $dStart = (string) ($cand->get('dateStart') ?? '');
                        $dEnd = (string) ($cand->get('dateEnd') ?? '');
                        return ($dStart === '' || $dStart <= $today) && ($dEnd === '' || $dEnd >= $today);
                    };

                    $goalEntity = null;
                    if (!empty($targetUserId)) {
                        $userGoals = $goalRepo->where([
                            'scopeType' => 'user',
                            'assignedUserId' => $targetUserId,
                        ])->find();
                        foreach ($userGoals as $cand) {
                            if ($isGoalActive($cand)) {
                                $goalEntity = $cand;
                                break;
                            }
                        }
                    }

                    if (!$goalEntity && $user !== null) {
                        $userTeamIds = method_exists($user, 'getTeamIdList') ? $user->getTeamIdList() : [];
                        if (!empty($userTeamIds)) {
                            $teamGoals = $goalRepo->where([
                                'scopeType' => 'team',
                                'teamId' => $userTeamIds,
                            ])->find();
                            foreach ($teamGoals as $cand) {
                                if ($isGoalActive($cand)) {
                                    $goalEntity = $cand;
                                    break;
                                }
                            }
                        }
                    }

                    if (!$goalEntity) {
                        $allGoals = $goalRepo->where(['scopeType' => 'all'])->find();
                        foreach ($allGoals as $cand) {
                            if ($isGoalActive($cand)) {
                                $goalEntity = $cand;
                                break;
                            }
                        }
                    }

                    if ($goalEntity) {
                        $goalData = [
                            'id' => $goalEntity->getId(),
                            'name' => (string) ($goalEntity->get('name') ?? ''),
                            'metricType' => (string) ($goalEntity->get('metricType') ?? 'wonAmount'),
                            'scopeType' => (string) ($goalEntity->get('scopeType') ?? 'all'),
                            'targetValue' => (float) ($goalEntity->get('targetValue') ?? 0.0),
                            'assignedUserId' => $goalEntity->get('assignedUserId'),
                            'teamId' => $goalEntity->get('teamId'),
                            'dateStart' => $goalEntity->get('dateStart'),
                            'dateEnd' => $goalEntity->get('dateEnd'),
                        ];
                    }
                }
            } catch (\Throwable) {
                // Ignore if BidarGoal entity is not available in mock/test environment
            }
        }

        $result = $this->service->calculateSummary($deals, $activities, $stages, $goalData);

        return ResponseComposer::json($result);
    }
}
