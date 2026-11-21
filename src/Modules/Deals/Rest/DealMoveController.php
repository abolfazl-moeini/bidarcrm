<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Deals\Rest;

use DidarCRM\Modules\Deals\Services\DealService;
use DidarCRM\Modules\Deals\Services\PipelineService;
use WPDev\Support\Rest\RestHandler;
use WP_REST_Request;
use WP_REST_Response;

class DealMoveController extends RestHandler
{
    public function rest_namespace(): string
    {
        return 'wpdev-didar-crm/v1';
    }

    public function rest_end_point(): string
    {
        return 'deals/(?P<id>[\d]+)/move';
    }

    public function methods(): string
    {
        return 'POST, PATCH';
    }

    public function rest_permission(): bool
    {
        if (function_exists('current_user_can')) {
            return current_user_can('manage_options') || current_user_can('edit_posts');
        }
        return true;
    }

    public function rest_handler(WP_REST_Request $request): WP_REST_Response
    {
        $id = (int) $request->get_param('id');
        $params = $request->get_json_params() ?: $request->get_params();
        $target_stage = (string) ($params['stage_id'] ?? $params['stage'] ?? '');

        if (empty($target_stage)) {
            return new WP_REST_Response([
                'code'    => 'missing_stage',
                'message' => 'Target stage_id is required',
            ], 400);
        }

        $dealService = new DealService();
        $pipelineService = new PipelineService();

        try {
            $updatedDeal = $dealService->move_deal($id, $target_stage);
            $metrics = $pipelineService->get_pipeline_metrics((int) ($updatedDeal['pipeline_id'] ?? 1));

            return new WP_REST_Response([
                'success'          => true,
                'deal'             => $updatedDeal,
                'stage_id'         => $updatedDeal['stage_id'],
                'win_probability'  => $updatedDeal['win_probability'],
                'pipeline_metrics' => $metrics,
            ], 200);
        } catch (\Throwable $e) {
            return new WP_REST_Response([
                'code'    => 'deal_move_failed',
                'message' => $e->getMessage(),
            ], 404);
        }
    }
}
