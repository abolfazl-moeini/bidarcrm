<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Contacts\Rest;

use DidarCRM\Modules\Contacts\Services\CompanyService;
use WPDev\Support\Rest\RestHandler;
use WP_REST_Request;
use WP_REST_Response;

class CompaniesController extends RestHandler
{
    public function rest_namespace(): string
    {
        return 'wpdev-didar-crm/v1';
    }

    public function rest_end_point(): string
    {
        return 'companies';
    }

    public function methods(): string
    {
        return 'GET, POST';
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
        $service = new CompanyService();
        $method = $request->get_method();

        if ($method === 'POST') {
            $params = $request->get_json_params() ?: $request->get_params();
            $company = $service->create_company($params);
            return new WP_REST_Response($company, 201);
        }

        $companies = $service->get_companies();
        return new WP_REST_Response($companies, 200);
    }
}
