<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Hooks\Opportunity;

use DateTimeImmutable;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\SaveOptions;

class InitLastActivity implements BeforeSave
{
    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        if (!$entity->has('lastActivityAt') || empty($entity->get('lastActivityAt'))) {
            $now = new DateTimeImmutable('now');
            $entity->set('lastActivityAt', $now->format('Y-m-d H:i:s'));
        }
    }

    /**
     * Pure helper method for calculating or updating array data in unit tests.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function applyBeforeSaveData(array $data, ?DateTimeImmutable $now = null): array
    {
        if (empty($data['lastActivityAt'])) {
            $currentTime = $now ?? new DateTimeImmutable('now');
            $data['lastActivityAt'] = $currentTime->format('Y-m-d H:i:s');
        }

        return $data;
    }
}
