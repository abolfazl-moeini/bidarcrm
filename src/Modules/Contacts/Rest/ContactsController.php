<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Contacts\Rest;

use DidarCRM\Modules\Contacts\Services\ContactService;
use WPDev\Support\Rest\RestHandler;
use WP_REST_Request;
use WP_REST_Response;

class ContactsController extends RestHandler
{
    public function rest_namespace(): string
    {
        return 'wpdev-didar-crm/v1';
    }

    public function rest_end_point(): string
    {
        return 'contacts';
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
        $service = new ContactService();
        $method = $request->get_method();

        if ($method === 'POST') {
            $params = $request->get_json_params() ?: $request->get_params();
            $contact = $service->create_contact($params);
            return new WP_REST_Response($contact, 201);
        }

        $contacts = $service->get_contacts();
        return new WP_REST_Response($contacts, 200);
    }
}
