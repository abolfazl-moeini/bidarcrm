<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Hooks\Common;

use DateTimeImmutable;
use Espo\Core\Hook\Hook\AfterSave;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\Option\SaveOptions;

class UpdateOpportunityActivity implements AfterSave
{
    private ?EntityManager $entityManager;

    public function __construct(?EntityManager $entityManager = null)
    {
        $this->entityManager = $entityManager;
    }

    public function shouldUpdateForParent(?string $parentType): bool
    {
        return $parentType === 'Opportunity';
    }

    public function isTargetEntityType(string $entityType): bool
    {
        return in_array($entityType, ['Note', 'Call', 'Meeting', 'Task'], true);
    }

    public function afterSave(Entity $entity, SaveOptions $options): void
    {
        $entityType = $entity->getEntityType();
        if (!$this->isTargetEntityType($entityType)) {
            return;
        }

        $parentType = $entity->has('parentType') ? (string) $entity->get('parentType') : null;
        $parentId = $entity->has('parentId') ? (string) $entity->get('parentId') : null;

        if (!$this->shouldUpdateForParent($parentType) || empty($parentId)) {
            return;
        }

        if ($this->entityManager !== null) {
            $opportunity = $this->entityManager->getEntityById('Opportunity', $parentId);
            if ($opportunity !== null) {
                $now = new DateTimeImmutable('now');
                $opportunity->set('lastActivityAt', $now->format('Y-m-d H:i:s'));
                $this->entityManager->saveEntity($opportunity, [
                    'silent' => true,
                    'skipHooks' => true,
                ]);
            }
        }
    }

    /**
     * Pure helper method for calculating opportunity last activity update payload.
     *
     * @return array{id: string, lastActivityAt: string}
     */
    public function updateOpportunityLastActivity(string $opportunityId, ?DateTimeImmutable $now = null): array
    {
        $currentTime = $now ?? new DateTimeImmutable('now');

        return [
            'id' => $opportunityId,
            'lastActivityAt' => $currentTime->format('Y-m-d H:i:s'),
        ];
    }
}
