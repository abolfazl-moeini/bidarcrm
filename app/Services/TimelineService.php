<?php

namespace App\Services;

use App\Models\TimelineEvent;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class TimelineService
{
    /**
     * Log an activity event to the unified timeline.
     */
    public function log(
        Model $subject,
        string $type,
        string $description,
        array $meta = [],
        ?int $userId = null
    ): TimelineEvent {
        return TimelineEvent::create([
            'timelineable_type' => get_class($subject),
            'timelineable_id' => $subject->getKey(),
            'type' => $type,
            'description' => $description,
            'meta' => $meta,
            'user_id' => $userId ?? auth()->id(),
        ]);
    }

    /**
     * Retrieve chronologically ordered timeline events for a subject (most recent first).
     */
    public function getTimelineFor(Model $subject, int $limit = 50): Collection
    {
        return TimelineEvent::query()
            ->where('timelineable_type', get_class($subject))
            ->where('timelineable_id', $subject->getKey())
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc')
            ->limit($limit)
            ->get();
    }
}
