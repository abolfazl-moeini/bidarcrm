<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Contacts\Services;

class TimelineService
{
    private const OPTION_KEY = 'didar_crm_timelines';

    /**
     * @return array<int, array<string, mixed>>
     */
    public function get_timeline(string $entity_type, int $entity_id): array
    {
        $all = get_option(self::OPTION_KEY, []);
        if (!is_array($all)) {
            $all = [];
        }

        $key = "{$entity_type}_{$entity_id}";
        return $all[$key] ?? [];
    }

    /**
     * @param array<string, mixed> $meta
     * @return array<string, mixed>
     */
    public function log_event(string $entity_type, int $entity_id, string $type, string $description, array $meta = []): array
    {
        $all = get_option(self::OPTION_KEY, []);
        if (!is_array($all)) {
            $all = [];
        }

        $key = "{$entity_type}_{$entity_id}";
        if (!isset($all[$key]) || !is_array($all[$key])) {
            $all[$key] = [];
        }

        $event = [
            'id'          => uniqid('evt_', true),
            'type'        => $type,
            'description' => $description,
            'meta'        => $meta,
            'created_at'  => gmdate('Y-m-d\TH:i:s\Z'),
        ];

        // Insert at beginning of timeline (most recent first)
        array_unshift($all[$key], $event);
        update_option(self::OPTION_KEY, $all);

        return $event;
    }
}
