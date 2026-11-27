<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Hooks\Opportunity;

use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\Option\SaveOptions;

class PipelineStageSync implements BeforeSave
{
    public static int $order = -10;

    public function __construct(
        private ?EntityManager $entityManager = null
    ) {}

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $isNew = $entity->isNew();
        $pipelineStageChanged = $isNew || $entity->isAttributeChanged('pipelineStageId');
        $stageChanged = $isNew || $entity->isAttributeChanged('stage');
        $hasPipelineStageId = !empty($entity->get('pipelineStageId'));
        $hasStage = !empty($entity->get('stage'));

        // 1. If pipelineStageId is newly set or updated, resolve the PipelineStage and sync stage & pipeline
        if ($hasPipelineStageId && $pipelineStageChanged) {
            $stageId = (string) $entity->get('pipelineStageId');

            if ($this->entityManager !== null) {
                $stage = $this->entityManager->getEntityById('PipelineStage', $stageId);
                if ($stage !== null) {
                    $pipelineId = $stage->get('pipelineId');
                    $currentPipelineId = $entity->get('pipelineId');
                    if (!empty($currentPipelineId) && !empty($pipelineId) && (string) $currentPipelineId !== (string) $pipelineId) {
                        return;
                    }
                    if ($pipelineId) {
                        $entity->set('pipelineId', $pipelineId);
                        if ($stage->has('pipelineName')) {
                            $entity->set('pipelineName', $stage->get('pipelineName'));
                        }
                    }

                    $entity->set('pipelineStageName', $stage->get('name'));

                    $mappedStatus = method_exists($stage, 'getMappedStatus')
                        ? $stage->getMappedStatus()
                        : $stage->get('mappedStatus');

                    if ($mappedStatus) {
                        $entity->set('stage', $mappedStatus);
                    } elseif ($stage->get('name')) {
                        $entity->set('stage', $stage->get('name'));
                    }
                }
            }
        } elseif ($hasStage && $stageChanged) {
            // 2. If stage is present/updated directly, resolve matching stage (scoped to pipelineId when present)
            $stageValue = (string) $entity->get('stage');
            $currentPipelineId = $entity->get('pipelineId');

            if ($this->entityManager !== null) {
                $stage = null;
                $stageRepo = $this->entityManager->getRDBRepository('PipelineStage');

                if (!empty($currentPipelineId)) {
                    $candidates = $stageRepo->where(['pipelineId' => (string) $currentPipelineId])->find();
                    foreach ($candidates as $candidate) {
                        if ($candidate->get('mappedStatus') === $stageValue || $candidate->get('name') === $stageValue) {
                            $stage = $candidate;
                            break;
                        }
                    }
                } else {
                    $stage = $stageRepo->where(['mappedStatus' => $stageValue])->findOne()
                        ?? $stageRepo->where(['name' => $stageValue])->findOne();
                }

                if ($stage !== null) {
                    $entity->set('pipelineStageId', $stage->getId());
                    $entity->set('pipelineStageName', $stage->get('name'));
                    if ($stage->get('pipelineId')) {
                        $entity->set('pipelineId', $stage->get('pipelineId'));
                        if ($stage->has('pipelineName')) {
                            $entity->set('pipelineName', $stage->get('pipelineName'));
                        }
                    }
                }
            }
        }

        // 3. Ensure pipelineId fallback if missing, scoped to Opportunity pipelines
        if (empty($entity->get('pipelineId')) && $this->entityManager !== null) {
            $pipeline = $this->entityManager->getRDBRepository('Pipeline')
                ->where(['entityType' => 'Opportunity'])
                ->findOne();
            if ($pipeline !== null) {
                $entity->set('pipelineId', $pipeline->getId());
                $entity->set('pipelineName', $pipeline->get('name'));
            }
        }
    }

    /**
     * Pure array-transformation helper for unit testing.
     *
     * @param array<string, mixed> $data
     * @param list<array<string, mixed>> $stageDefs
     * @return array<string, mixed>
     */
    public static function applySyncData(array $data, array $stageDefs = []): array
    {
        if (!empty($data['pipelineStageId'])) {
            $stageId = (string) $data['pipelineStageId'];
            $requestedPipelineId = !empty($data['pipelineId']) ? (string) $data['pipelineId'] : null;
            foreach ($stageDefs as $def) {
                if ($requestedPipelineId !== null && !empty($def['pipelineId']) && (string) $def['pipelineId'] !== $requestedPipelineId) {
                    continue;
                }
                if (($def['id'] ?? null) === $stageId) {
                    if (!empty($def['pipelineId'])) {
                        $data['pipelineId'] = $def['pipelineId'];
                    }
                    if (!empty($def['name'])) {
                        $data['pipelineStageName'] = $def['name'];
                    }
                    if (!empty($def['mappedStatus'])) {
                        $data['stage'] = $def['mappedStatus'];
                    } elseif (!empty($def['name'])) {
                        $data['stage'] = $def['name'];
                    }
                    break;
                }
            }
        } elseif (!empty($data['stage'])) {
            $stageValue = (string) $data['stage'];
            $requestedPipelineId = !empty($data['pipelineId']) ? (string) $data['pipelineId'] : null;
            foreach ($stageDefs as $def) {
                if ($requestedPipelineId !== null && ($def['pipelineId'] ?? null) !== $requestedPipelineId) {
                    continue;
                }
                if (($def['mappedStatus'] ?? null) === $stageValue || ($def['name'] ?? null) === $stageValue) {
                    $data['pipelineStageId'] = $def['id'] ?? null;
                    $data['pipelineStageName'] = $def['name'] ?? null;
                    if (!empty($def['pipelineId'])) {
                        $data['pipelineId'] = $def['pipelineId'];
                    }
                    break;
                }
            }
        }

        return $data;
    }
}
