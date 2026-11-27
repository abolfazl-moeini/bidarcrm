<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Api;

use Espo\Core\Acl;
use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Container;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\BidarIran\Services\SmsCampaignService;
use Espo\ORM\EntityManager;

class PostSendSms implements Action
{
    public function __construct(
        private ?SmsCampaignService $service = null,
        private ?EntityManager $entityManager = null,
        private ?Container $container = null,
        private ?Acl $acl = null
    ) {}

    public function getService(): SmsCampaignService
    {
        if ($this->service === null) {
            $em = $this->entityManager ?? ($this->container !== null && $this->container->has('entityManager') ? $this->container->get('entityManager') : null);
            $this->service = new SmsCampaignService(null, $em);
        }
        return $this->service;
    }

    public function process(Request $request): Response
    {
        $acl = $this->acl;
        if ($acl === null && $this->container !== null && $this->container->has('acl')) {
            $acl = $this->container->get('acl');
        }
        if ($acl !== null && !$acl->check('BidarSmsMessage', 'create')) throw new Forbidden('Access denied to send SMS.');

        $body = self::toArray($request->getParsedBody());
        foreach (['templateId', 'phone', 'phoneNumber', 'recipient', 'contactId', 'opportunityId', 'message', 'body'] as $field) {
            if (array_key_exists($field, $body) && $body[$field] !== null && !is_string($body[$field])) {
                throw new BadRequest(sprintf('%s must be a string.', $field));
            }
        }
        if (array_key_exists('variables', $body) && $body['variables'] !== null && (!is_array($body['variables']) || ($body['variables'] !== [] && array_is_list($body['variables'])))) {
            throw new BadRequest('Variables must be an object.');
        }
        $recipients = $body['recipients'] ?? null;
        if ($recipients !== null && (!is_array($recipients) || (!array_is_list($recipients) && $recipients !== []))) {
            throw new BadRequest('Recipients must be a list of objects.');
        }
        if (is_array($recipients)) {
            foreach ($recipients as $recipient) {
                if (!is_array($recipient) || array_is_list($recipient)) throw new BadRequest('Each recipient must be an object.');
                foreach (['phone', 'phoneNumber', 'recipient', 'contactId', 'opportunityId'] as $field) {
                    if (array_key_exists($field, $recipient) && $recipient[$field] !== null && !is_string($recipient[$field])) {
                        throw new BadRequest(sprintf('Recipient %s must be a string.', $field));
                    }
                }
                if (array_key_exists('variables', $recipient) && $recipient['variables'] !== null &&
                    (!is_array($recipient['variables']) || ($recipient['variables'] !== [] && array_is_list($recipient['variables'])))) {
                    throw new BadRequest('Recipient variables must be an object.');
                }
            }
        }
        $templateId = $body['templateId'] ?? '';
        $templateId = is_string($templateId) ? trim($templateId) : '';
        if ($templateId !== '' && $acl !== null && !$acl->check('BidarSmsTemplate', 'read')) throw new Forbidden('Access denied to SMS template.');

        $rawMessage = $body['message'] ?? $body['body'] ?? '';
        $message = is_string($rawMessage) ? trim($rawMessage) : '';
        $service = $this->getService();
        if ($message === '' && $templateId !== '') {
            $templateBody = $service->getTemplateBody($templateId);
            if ($templateBody === null || trim($templateBody) === '') throw new BadRequest('The selected SMS template does not exist or is inactive.');
            $message = $templateBody;
        }
        $variables = $body['variables'] ?? [];
        $variables = is_array($variables) ? $variables : [];

        if (is_array($recipients) && $recipients !== []) {
            if ($message === '') throw new BadRequest('Missing SMS template or message body for campaign.');
            return ResponseComposer::json($service->sendCampaign($recipients, $message, $variables));
        }
        if (is_array($recipients) && $recipients === [] && trim((string) ($body['phone'] ?? $body['phoneNumber'] ?? $body['recipient'] ?? '')) === '') {
            throw new BadRequest('At least one recipient phone number is required.');
        }

        $phone = $body['phone'] ?? $body['phoneNumber'] ?? $body['recipient'] ?? '';
        if (!is_string($phone) || trim($phone) === '') throw new BadRequest('Recipient phone number is required.');
        if ($message === '') throw new BadRequest('SMS message body or valid templateId is required.');
        if ($variables !== []) $message = $service->renderTemplate($message, $variables);
        $contactId = isset($body['contactId']) && is_string($body['contactId']) && trim($body['contactId']) !== ''
            ? trim($body['contactId'])
            : null;
        $opportunityId = isset($body['opportunityId']) && is_string($body['opportunityId']) && trim($body['opportunityId']) !== ''
            ? trim($body['opportunityId'])
            : null;
        return ResponseComposer::json($service->sendSms(trim($phone), $message, $contactId, $opportunityId));
    }

    /** @return array<string, mixed> */
    private static function toArray(mixed $value): array
    {
        if ($value instanceof \stdClass) $value = get_object_vars($value);
        if (!is_array($value)) return [];
        $out = [];
        foreach ($value as $key => $item) $out[$key] = $item instanceof \stdClass || is_array($item) ? self::toArray($item) : $item;
        return $out;
    }
}
