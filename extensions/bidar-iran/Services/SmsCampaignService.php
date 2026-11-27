<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Services;

use Espo\Modules\BidarIran\Sms\KavenegarSender;
use Espo\ORM\EntityManager;
use Throwable;

class SmsCampaignService
{
    private KavenegarSender $sender;
    private ?EntityManager $entityManager;

    public function __construct(
        ?KavenegarSender $sender = null,
        ?EntityManager $entityManager = null
    ) {
        $this->entityManager = $entityManager;
        $this->sender = $sender ?? new KavenegarSender(null, null, null, null, $entityManager);
    }

    public function getSender(): KavenegarSender
    {
        return $this->sender;
    }

    /**
     * Replaces {contactName}, {accountName}, {dealName} and custom {variables} in template string.
     *
     * @param array<string, mixed> $variables
     */
    public function renderTemplate(string $template, array $variables = []): string
    {
        $map = [];
        foreach ($variables as $key => $value) {
            $cleanedKey = trim((string) $key, '{}');
            if ($cleanedKey === '' || (!is_scalar($value) && !$value instanceof \Stringable)) continue;
            $map['{' . $cleanedKey . '}'] = (string) $value;
        }

        return strtr($template, $map);
    }

    /**
     * Retrieve SMS template body by ID from metadata/database.
     */
    public function getTemplateBody(string $templateId): ?string
    {
        if ($this->entityManager === null) {
            return null;
        }

        $template = $this->entityManager->getEntityById('BidarSmsTemplate', $templateId);
        if ($template === null) {
            return null;
        }

        if ($template->get('isActive') === false) return null;
        $body = trim((string) ($template->get('body') ?? ''));
        return $body === '' ? null : $body;
    }

    /**
     * Send single SMS and log result into BidarSmsMessage.
     *
     * @return array{
     *     success: bool,
     *     status: string,
     *     phoneNumber: string,
     *     message: string,
     *     id: ?string,
     *     error?: string
     * }
     */
    public function sendSms(
        string $phoneNumber,
        string $message,
        ?string $contactId = null,
        ?string $opportunityId = null
    ): array {
        $status = 'failed';
        $error = null;
        $smsRecordId = null;
        $logError = null;
        $normalizer = new \Espo\Modules\BidarIran\Support\IranPhoneNormalizer();
        $normalizedPhone = $normalizer->toLocal($phoneNumber) ?? substr(trim($phoneNumber), 0, 32);

        try {
            $dispatched = $this->sender->sendDirect($phoneNumber, $message);
            if ($dispatched) {
                $status = 'sent';
            }
        } catch (Throwable $e) {
            $status = 'failed';
            $error = $e->getMessage();
        }

        if ($this->entityManager !== null) {
            try {
                $smsRecord = $this->entityManager->getNewEntity('BidarSmsMessage');
                $smsRecord->set('phoneNumber', $normalizedPhone);
                $smsRecord->set('body', $message);
                $smsRecord->set('status', $status);
                if ($contactId !== null) {
                    $smsRecord->set('contactId', $contactId);
                }
                if ($opportunityId !== null) {
                    $smsRecord->set('opportunityId', $opportunityId);
                }

                $providerMessageId = $status === 'sent' && method_exists($this->sender, 'getLastProviderMessageId') ? $this->sender->getLastProviderMessageId() : null;
                if (is_string($providerMessageId) && $providerMessageId !== '') $smsRecord->set('providerMessageId', substr($providerMessageId, 0, 64));
                $this->entityManager->saveEntity($smsRecord);
                $smsRecordId = $smsRecord->getId();
            } catch (Throwable $e) {
                // Log failure should not override dispatch outcome
                $logError = 'SMS dispatch result could not be logged.';
            }
        }

        $result = [
            'success' => $status === 'sent',
            'status' => $status,
            'phoneNumber' => $phoneNumber,
            'message' => $message,
            'id' => $smsRecordId,
        ];

        if ($error !== null) {
            $result['error'] = $error;
        }
        if ($logError !== null) $result['logError'] = $logError;

        return $result;
    }

    /**
     * Broadcast SMS campaign to a group of recipients with individualized variable rendering.
     *
     * @param list<array<string, mixed>> $recipients
     * @param array<string, mixed> $defaultVariables
     * @return array{
     *     total: int,
     *     sent: int,
     *     failed: int,
     *     results: list<array<string, mixed>>
     * }
     */
    public function sendCampaign(
        array $recipients,
        string $templateBody,
        array $defaultVariables = []
    ): array {
        $sentCount = 0;
        $failedCount = 0;
        $results = [];

        foreach ($recipients as $recipient) {
            if ($recipient instanceof \stdClass) $recipient = get_object_vars($recipient);
            if (!is_array($recipient)) $recipient = [];
            $phoneValue = $recipient['phoneNumber'] ?? $recipient['phone'] ?? '';
            $phone = is_string($phoneValue) ? $phoneValue : '';
            if ($phone === '') {
                $failedCount++;
                $results[] = [
                    'success' => false,
                    'status' => 'failed',
                    'phoneNumber' => '',
                    'message' => '',
                    'id' => null,
                    'error' => 'Missing phone number',
                ];
                continue;
            }

            $variables = $defaultVariables;
            foreach (['contactName' => $recipient['contactName'] ?? $recipient['name'] ?? null, 'accountName' => $recipient['accountName'] ?? null, 'dealName' => $recipient['dealName'] ?? null] as $key => $value) {
                if (is_scalar($value) && trim((string) $value) !== '') $variables[$key] = (string) $value;
            }

            $recipientVariables = $recipient['variables'] ?? null;
            if ($recipientVariables instanceof \stdClass) $recipientVariables = get_object_vars($recipientVariables);
            if (is_array($recipientVariables)) {
                $variables = array_merge($variables, $recipientVariables);
            }

            $renderedMessage = $this->renderTemplate($templateBody, $variables);
            $contactId = isset($recipient['contactId']) && is_string($recipient['contactId']) && trim($recipient['contactId']) !== ''
                ? trim($recipient['contactId'])
                : null;
            $opportunityId = isset($recipient['opportunityId']) && is_string($recipient['opportunityId']) && trim($recipient['opportunityId']) !== ''
                ? trim($recipient['opportunityId'])
                : null;

            $sendResult = $this->sendSms($phone, $renderedMessage, $contactId, $opportunityId);
            $results[] = $sendResult;

            if ($sendResult['success']) {
                $sentCount++;
            } else {
                $failedCount++;
            }
        }

        return [
            'total' => count($recipients),
            'sent' => $sentCount,
            'failed' => $failedCount,
            'results' => $results,
        ];
    }
}
