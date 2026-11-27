<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Hooks\Common;

use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\SaveOptions;
use Espo\Modules\BidarIran\Support\PersianTextNormalizer;

/**
 * @implements BeforeSave<Entity>
 */
class NormalizePersianInput implements BeforeSave
{
    private const ALLOWED_ENTITIES = ['Account', 'Contact', 'Lead', 'Opportunity', 'Task', 'Call', 'Meeting', 'BidarSmsTemplate'];
    private const TEXT_FIELDS = ['name', 'firstName', 'lastName', 'description', 'iranCity', 'body', 'title', 'subject'];

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        if (!in_array($entity->getEntityType(), self::ALLOWED_ENTITIES, true)) {
            return;
        }

        foreach (self::TEXT_FIELDS as $field) {
            if ($entity->has($field)) {
                $val = $entity->get($field);
                if (is_string($val) && $val !== '') {
                    $normalized = PersianTextNormalizer::normalizeCharacters($val);
                    if ($normalized !== $val) {
                        $entity->set($field, $normalized);
                    }
                }
            }
        }

        $numericFields = match ($entity->getEntityType()) {
            'Account' => ['nationalId'],
            'Contact' => ['nationalCode'],
            default => [],
        };
        foreach ($numericFields as $field) {
            if (!$entity->has($field)) continue;
            $value = $entity->get($field);
            if (!is_string($value) || $value === '') {
                continue;
            }
            $normalized = PersianTextNormalizer::toEnglishDigits($value);
            $normalized = (string) preg_replace('/[\s\x{00A0}\x{200C}\-]+/u', '', $normalized);
            if ($normalized !== $value) {
                $entity->set($field, $normalized);
            }
        }
    }
}
