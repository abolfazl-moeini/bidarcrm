<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Contacts\Rest;

use DidarCRM\Modules\Contacts\Services\ContactService;
use WPDev\Support\Rest\RestHandler;
use WP_REST_Request;
use WP_REST_Response;

class ContactLinkController extends RestHandler
{
    public function rest_namespace(): string
    {
        return 'wpdev-didar-crm/v1';
    }

    public function rest_end_point(): string
    {
        return 'contacts/(?P<id>[\d]+)/link';
    }

    public function methods(): string
    {
        return 'POST';
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

        $company_id = isset($params['company_id']) ? (int) $params['company_id'] : 0;
        $custom_fields = isset($params['custom_fields']) && is_array($params['custom_fields']) ? $params['custom_fields'] : [];

        if ($company_id <= 0) {
            return new WP_REST_Response([
                'code'    => 'missing_company',
                'message' => 'company_id is required',
            ], 400);
        }

        $service = new ContactService();

        try {
            $result = $service->link_to_company($id, $company_id, $custom_fields);
            return new WP_REST_Response($result, 200);
        } catch (\Throwable $e) {
            return new WP_REST_Response([
                'code'    => 'link_failed',
                'message' => $e->getMessage(),
            ], 404);
        }
    }
}
