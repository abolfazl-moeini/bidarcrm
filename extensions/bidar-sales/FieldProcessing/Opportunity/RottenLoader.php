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

        $lastActivityAt = new DateTimeImmutable((string) $lastActivityStr);
        $stageProbability = $entity->has('stageProbability') ? (string) $entity->get('stageProbability') : null;

        $stageRottenDays = null;
        if ($entity->has('stageRottenDays') && $entity->get('stageRottenDays') !== null) {
            $stageRottenDays = (int) $entity->get('stageRottenDays');
        } elseif ($this->entityManager !== null && $entity->has('pipelineStageId') && !empty($entity->get('pipelineStageId'))) {
            $stage = $this->entityManager->getEntityById('PipelineStage', (string) $entity->get('pipelineStageId'));
            if ($stage !== null && $stage->has('rottenDays')) {
                $stageRottenDays = (int) $stage->get('rottenDays');
            }
        }

        $now = new DateTimeImmutable('now');
        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

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
        if ($lastActivityStr === null) {
            $opportunity['isRotten'] = false;
            $opportunity['daysSinceLastActivity'] = 0;
            return $opportunity;
        }

        $lastActivityAt = new DateTimeImmutable($lastActivityStr);
        $stageProbability = $opportunity['stageProbability'] ?? null;
        $stageRottenDays = isset($opportunity['stageRottenDays']) ? (int) $opportunity['stageRottenDays'] : null;

        $result = $this->calculator->calculate($stageProbability, $stageRottenDays, $lastActivityAt, $now);

        $opportunity['isRotten'] = $result->isRotten();
        $opportunity['daysSinceLastActivity'] = $result->daysSinceLastActivity();

        return $opportunity;
    }
}
