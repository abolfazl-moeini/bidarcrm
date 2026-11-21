<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Deals\Services;

class DealService
{
    private const OPTION_KEY = 'didar_crm_deals';

    /**
     * @param array<string, mixed> $args
     * @return array<int, array<string, mixed>>
     */
    public function get_deals(array $args = []): array
    {
        $deals = get_option(self::OPTION_KEY, []);
        if (!is_array($deals)) {
            $deals = [];
        }

        $results = [];
        $pipeline_id = isset($args['pipeline_id']) ? (int) $args['pipeline_id'] : null;
        $stage_id = isset($args['stage_id']) ? (string) $args['stage_id'] : null;
        $status = isset($args['status']) ? (string) $args['status'] : null;

        $pipelineService = new PipelineService();

        foreach ($deals as $deal) {
            if ($pipeline_id !== null && (int) ($deal['pipeline_id'] ?? 0) !== $pipeline_id) {
                continue;
            }
            if ($stage_id !== null && ($deal['stage_id'] ?? '') !== $stage_id) {
                continue;
            }
            if ($status !== null && ($deal['status'] ?? '') !== $status) {
                continue;
            }

            // Hydrate stage info and calculate rotten status
            $this->calculate_rotten_status($deal, $pipelineService);
            $results[] = $deal;
        }

        return $results;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get_deal(int $id): ?array
    {
        $deals = get_option(self::OPTION_KEY, []);
        if (is_array($deals) && isset($deals[$id])) {
            $deal = $deals[$id];
            $pipelineService = new PipelineService();
            $this->calculate_rotten_status($deal, $pipelineService);
            return $deal;
        }
        return null;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create_deal(array $data): array
    {
        $deals = get_option(self::OPTION_KEY, []);
        if (!is_array($deals)) {
            $deals = [];
        }

        $next_id = empty($deals) ? 101 : (max(array_keys($deals)) + 1);

        $pipeline_id = (int) ($data['pipeline_id'] ?? 1);
        $stage_id = (string) ($data['stage_id'] ?? 'lead-in');

        $pipelineService = new PipelineService();
        $pipeline = $pipelineService->get_pipeline($pipeline_id);

        $win_prob = 10;
        $rotten_days = 5;
        if ($pipeline && !empty($pipeline['stages'])) {
            foreach ($pipeline['stages'] as $s) {
                if ($s['id'] === $stage_id) {
                    $win_prob = (int) ($s['win_probability'] ?? 10);
                    $rotten_days = (int) ($s['rotten_days'] ?? 5);
                    break;
                }
            }
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $deal = [
            'id'               => $next_id,
            'title'            => (string) ($data['title'] ?? 'Untitled Deal'),
            'amount'           => (int) ($data['amount'] ?? 0),
            'pipeline_id'      => $pipeline_id,
            'stage_id'         => $stage_id,
            'status'           => (string) ($data['status'] ?? 'open'),
            'win_probability'  => $win_prob,
            'days_in_stage'    => (int) ($data['days_in_stage'] ?? 0),
            'last_activity_at' => (string) ($data['last_activity_at'] ?? $now),
            'stage_entered_at' => $now,
            'created_at'       => $now,
            'assigned_user_id' => (int) ($data['assigned_user_id'] ?? 1),
            'is_rotten'        => (bool) ($data['is_rotten'] ?? false),
        ];

        // Check rotten calculation
        if (!isset($data['is_rotten'])) {
            $deal['is_rotten'] = $this->is_rotten($deal, ['rotten_days' => $rotten_days]);
        }

        $deals[$next_id] = $deal;
        update_option(self::OPTION_KEY, $deals);

        return $deal;
    }

    /**
     * Move deal to another stage.
     *
     * @return array<string, mixed>
     */
    public function move_deal(int $id, string $target_stage_id): array
    {
        $deals = get_option(self::OPTION_KEY, []);
        if (!is_array($deals) || !isset($deals[$id])) {
            throw new \InvalidArgumentException(sprintf('Deal with ID %d not found', $id));
        }

        $deal = $deals[$id];
        $pipelineService = new PipelineService();
        $pipeline = $pipelineService->get_pipeline((int) ($deal['pipeline_id'] ?? 1));

        $win_prob = (int) ($deal['win_probability'] ?? 0);
        $rotten_days = 0;
        if ($pipeline && !empty($pipeline['stages'])) {
            foreach ($pipeline['stages'] as $s) {
                if ($s['id'] === $target_stage_id) {
                    $win_prob = (int) ($s['win_probability'] ?? 50);
                    $rotten_days = (int) ($s['rotten_days'] ?? 0);
                    break;
                }
            }
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $deal['stage_id'] = $target_stage_id;
        $deal['win_probability'] = $win_prob;
        $deal['stage_entered_at'] = $now;
        $deal['days_in_stage'] = 0;
        $deal['last_activity_at'] = $now;
        $deal['is_rotten'] = false; // Fresh in new stage

        $deals[$id] = $deal;
        update_option(self::OPTION_KEY, $deals);

        return $deal;
    }

    /**
     * Calculate whether a deal is rotten based on days in stage vs stage rotten_days.
     *
     * @param array<string, mixed> $deal
     * @param array<string, mixed> $stage
     */
    public function is_rotten(array $deal, array $stage): bool
    {
        $threshold = (int) ($stage['rotten_days'] ?? 0);
        if ($threshold <= 0) {
            return false;
        }

        $days = (int) ($deal['days_in_stage'] ?? 0);
        if ($days <= 0 && !empty($deal['last_activity_at'])) {
            $last_ts = strtotime((string) $deal['last_activity_at']);
            if ($last_ts > 0) {
                $days = (int) floor((time() - $last_ts) / 86400);
            }
        }

        return $days >= $threshold;
    }

    /**
     * @param array<string, mixed> $deal
     */
    public function calculate_rotten_status(array &$deal, ?PipelineService $pipelineService = null): void
    {
        $pipelineService = $pipelineService ?? new PipelineService();
        $pipeline = $pipelineService->get_pipeline((int) ($deal['pipeline_id'] ?? 1));

        if (!$pipeline || empty($pipeline['stages'])) {
            return;
        }

        $stage = null;
        foreach ($pipeline['stages'] as $s) {
            if ($s['id'] === ($deal['stage_id'] ?? '')) {
                $stage = $s;
                break;
            }
        }

        if ($stage) {
            $deal['is_rotten'] = $this->is_rotten($deal, $stage);
        }
    }
}
