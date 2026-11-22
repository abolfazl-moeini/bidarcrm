<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Stage;
use Carbon\Carbon;

class DealService
{
    /**
     * Move a deal to a new stage, updating win probability, rotten status, and timestamps.
     */
    public function moveStage(Deal $deal, Stage|int $newStage): Deal
    {
        if (is_numeric($newStage)) {
            $newStage = Stage::findOrFail($newStage);
        }

        $now = Carbon::now();

        $deal->stage_id = $newStage->id;
        $deal->pipeline_id = $newStage->pipeline_id;
        $deal->win_probability = $newStage->win_probability;
        $deal->stage_entered_at = $now;
        $deal->days_in_stage = 0;
        $deal->is_rotten = false;
        $deal->last_activity_at = $now;
        $deal->save();

        return $deal->load(['stage', 'pipeline']);
    }

    /**
     * Recalculate rotten status and days in stage for deals.
     */
    public function recalculateRottenThresholds(?int $pipelineId = null): void
    {
        $query = Deal::query()->with('stage');

        if ($pipelineId) {
            $query->where('pipeline_id', $pipelineId);
        }

        $deals = $query->get();

        foreach ($deals as $deal) {
            $this->updateDealRottenStatus($deal);
        }
    }

    /**
     * Update an individual deal's rotten status and days in stage.
     */
    public function updateDealRottenStatus(Deal $deal): Deal
    {
        $stage = $deal->stage;
        $now = Carbon::now();
        $enteredAt = $deal->stage_entered_at ? Carbon::parse($deal->stage_entered_at) : ($deal->created_at ? Carbon::parse($deal->created_at) : $now);
        
        $daysInStage = (int) $enteredAt->diffInDays($now);

        $isRotten = false;
        if ($stage && $stage->rotten_days > 0 && $daysInStage >= $stage->rotten_days) {
            $isRotten = true;
        }

        $deal->days_in_stage = $daysInStage;
        $deal->is_rotten = $isRotten;
        $deal->save();

        return $deal;
    }
}
