<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Deals\Services;

class PipelineService
{
    private const OPTION_KEY = 'didar_crm_pipelines';

    /**
     * @return array<int, array<string, mixed>>
     */
    public function get_pipelines(): array
    {
        $pipelines = get_option(self::OPTION_KEY, []);
        if (!is_array($pipelines) || empty($pipelines)) {
            // Seed a default standard pipeline
            $default = [
                'id'         => 1,
                'title'      => 'Default Sales Pipeline',
                'is_default' => true,
                'stages'     => [
                    [
                        'id'              => 'lead-in',
                        'name'            => 'Lead In',
                        'rotten_days'     => 5,
                        'win_probability' => 10,
                    ],
                    [
                        'id'              => 'proposal',
                        'name'            => 'Proposal Sent',
                        'rotten_days'     => 10,
                        'win_probability' => 50,
                    ],
                    [
                        'id'              => 'negotiation',
                        'name'            => 'Negotiation',
                        'rotten_days'     => 14,
                        'win_probability' => 80,
                    ],
                    [
                        'id'              => 'won',
                        'name'            => 'Won',
                        'rotten_days'     => 0,
                        'win_probability' => 100,
                    ],
                    [
                        'id'              => 'lost',
                        'name'            => 'Lost',
                        'rotten_days'     => 0,
                        'win_probability' => 0,
                    ],
                ],
            ];
            $pipelines = [1 => $default];
            update_option(self::OPTION_KEY, $pipelines);
        }
        return array_values($pipelines);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get_pipeline(int $id): ?array
    {
        $pipelines = get_option(self::OPTION_KEY, []);
        if (is_array($pipelines) && isset($pipelines[$id])) {
            return $pipelines[$id];
        }
        foreach ($this->get_pipelines() as $pipeline) {
            if ((int) ($pipeline['id'] ?? 0) === $id) {
                return $pipeline;
            }
        }
        return null;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create_pipeline(array $data): array
    {
        $pipelines = get_option(self::OPTION_KEY, []);
        if (!is_array($pipelines)) {
            $pipelines = [];
        }

        $next_id = empty($pipelines) ? 1 : (max(array_keys($pipelines)) + 1);

        $stages = [];
        if (!empty($data['stages']) && is_array($data['stages'])) {
            foreach ($data['stages'] as $s) {
                $rawId = (string) ($s['id'] ?? $s['name'] ?? 'stage');
                $slug = function_exists('sanitize_title')
                    ? sanitize_title($rawId)
                    : strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $rawId), '-'));
                $stages[] = [
                    'id'              => $slug,
                    'name'            => (string) ($s['name'] ?? 'Stage'),
                    'rotten_days'     => (int) ($s['rotten_days'] ?? 0),
                    'win_probability' => (int) ($s['win_probability'] ?? 0),
                ];
            }
        } else {
            $stages = [
                ['id' => 'lead-in', 'name' => 'Lead In', 'rotten_days' => 5, 'win_probability' => 10],
                ['id' => 'proposal', 'name' => 'Proposal', 'rotten_days' => 10, 'win_probability' => 50],
            ];
        }

        $pipeline = [
            'id'         => $next_id,
            'title'      => (string) ($data['title'] ?? 'New Pipeline'),
            'is_default' => empty($pipelines),
            'stages'     => $stages,
            'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ];

        $pipelines[$next_id] = $pipeline;
        update_option(self::OPTION_KEY, $pipelines);

        return $pipeline;
    }

    /**
     * @return array<string, mixed>
     */
    public function get_pipeline_metrics(int $pipeline_id): array
    {
        $pipeline = $this->get_pipeline($pipeline_id);
        if (!$pipeline) {
            return ['pipeline_id' => $pipeline_id, 'stages' => []];
        }

        $dealService = new DealService();
        $deals = $dealService->get_deals(['pipeline_id' => $pipeline_id]);

        $stageMetrics = [];
        foreach ($pipeline['stages'] as $stage) {
            $stage_id = $stage['id'];
            $stageMetrics[$stage_id] = [
                'count'           => 0,
                'total_amount'    => 0,
                'win_probability' => $stage['win_probability'] ?? 0,
            ];
        }

        foreach ($deals as $deal) {
            $stage_id = $deal['stage_id'] ?? '';
            if (isset($stageMetrics[$stage_id])) {
                $stageMetrics[$stage_id]['count']++;
                $stageMetrics[$stage_id]['total_amount'] += (int) ($deal['amount'] ?? 0);
            }
        }

        return [
            'pipeline_id' => $pipeline_id,
            'stages'      => $stageMetrics,
        ];
    }
}
