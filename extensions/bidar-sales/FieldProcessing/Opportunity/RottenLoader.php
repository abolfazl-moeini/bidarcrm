<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\FieldProcessing\Opportunity;

use DateTimeImmutable;
use Espo\Core\FieldProcessing\Loader;
use Espo\Core\FieldProcessing\Loader\Params;
use Espo\Modules\BidarSales\Domain\RottenDealCalculator;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;

class RottenLoader implements Loader
{
    private RottenDealCalculator $calculator;
    private ?EntityManager $entityManager;

    public function __construct(
        ?RottenDealCalculator $calculator = null,
        ?EntityManager $entityManager = null
    ) {
        $this->calculator = $calculator ?? new RottenDealCalculator();
        $this->entityManager = $entityManager;
    }

    public function process(Entity $entity, Params $params): void
    {
        $lastActivityStr = $entity->has('lastActivityAt') ? $entity->get('lastActivityAt') : null;
        if (empty($lastActivityStr)) {
            $entity->set('isRotten', false);
            $entity->set('daysSinceLastActivity', 0);
            return;
        }

        try {
            $lastActivityAt = new DateTimeImmutable((string) $lastActivityStr);
        } catch (\Throwable) {
            $entity->set('isRotten', false);
            $entity->set('daysSinceLastActivity', null);
            return;
        }

        $stage = null;
        if ($entity->has('stage') && $entity->get('stage') !== null) {
            $stage = (string) $entity->get('stage');
        } elseif ($entity->has('stageProbability') && $entity->get('stageProbability') !== null) {
            $stage = (string) $entity->get('stageProbability');
        }

        $stageRottenDays = null;
        $stageMappedStatus = $entity->has('stageMappedStatus') && $entity->get('stageMappedStatus') !== null
            ? (string) $entity->get('stageMappedStatus')
            : null;
        if ($entity->has('stageRottenDays') && $entity->get('stageRottenDays') !== null) {
            $stageRottenDays = (int) $entity->get('stageRottenDays');
        } elseif ($this->entityManager !== null && $entity->has('pipelineStageId') && !empty($entity->get('pipelineStageId'))) {
            $pipelineStage = $this->entityManager->getEntityById('PipelineStage', (string) $entity->get('pipelineStageId'));
            if ($pipelineStage !== null) {
                if ($pipelineStage->has('rottenDays')) {
                    $stageRottenDays = (int) $pipelineStage->get('rottenDays');
                }
                if ($stageMappedStatus === null && $pipelineStage->has('mappedStatus') && $pipelineStage->get('mappedStatus') !== null) {
                    $stageMappedStatus = (string) $pipelineStage->get('mappedStatus');
                }
            }
        }

        $now = new DateTimeImmutable('now');

        // If stage or mappedStatus is 'Closed Won' or 'Closed Lost', isRotten must always be false
        $effectiveStage = ($stageMappedStatus === 'Closed Won' || $stageMappedStatus === 'Closed Lost')
            ? $stageMappedStatus
            : $stage;
        if ($effectiveStage === 'Closed Won' || $effectiveStage === 'Closed Lost') {
            $days = $lastActivityAt >= $now ? 0 : (int) $now->diff($lastActivityAt)->days;
            $entity->set('isRotten', false);
            $entity->set('daysSinceLastActivity', $days);
            return;
        }

        $result = $this->calculator->calculate($effectiveStage, $stageRottenDays, $lastActivityAt, $now);

        $entity->set('isRotten', $result->isRotten());
        $entity->set('daysSinceLastActivity', $result->daysSinceLastActivity());
    }

    /**
     * Pure helper method for processing array data in unit tests.
     *
     * @param array<string, mixed> $opportunity
     * @return array<string, mixed>
     */
    public function processData(array $opportunity, ?DateTimeImmutable $now = null): array
    {
        $now = $now ?? new DateTimeImmutable('now');

        $lastActivityStr = $opportunity['lastActivityAt'] ?? null;
        if ($lastActivityStr === null || $lastActivityStr === '') {
            $opportunity['isRotten'] = false;
            $opportunity['daysSinceLastActivity'] = 0;
            return $opportunity;
        }

        try {
            $lastActivityAt = new DateTimeImmutable((string) $lastActivityStr);
        } catch (\Throwable) {
            $opportunity['isRotten'] = false;
            $opportunity['daysSinceLastActivity'] = null;
            return $opportunity;
        }

        $stage = $opportunity['stage'] ?? $opportunity['stageProbability'] ?? null;
        if ($stage !== null) {
            $stage = (string) $stage;
        }
        $stageMappedStatus = isset($opportunity['stageMappedStatus']) ? (string) $opportunity['stageMappedStatus'] : null;
        $effectiveStage = ($stageMappedStatus === 'Closed Won' || $stageMappedStatus === 'Closed Lost')
            ? $stageMappedStatus
            : $stage;

        if ($effectiveStage === 'Closed Won' || $effectiveStage === 'Closed Lost') {
            $days = $lastActivityAt >= $now ? 0 : (int) $now->diff($lastActivityAt)->days;
            $opportunity['isRotten'] = false;
            $opportunity['daysSinceLastActivity'] = $days;
            return $opportunity;
        }

        $stageRottenDays = isset($opportunity['stageRottenDays']) ? (int) $opportunity['stageRottenDays'] : null;

        $result = $this->calculator->calculate($effectiveStage, $stageRottenDays, $lastActivityAt, $now);

        $opportunity['isRotten'] = $result->isRotten();
        $opportunity['daysSinceLastActivity'] = $result->daysSinceLastActivity();

        return $opportunity;
    }
}
