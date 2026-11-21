<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Contacts\Services;

class ContactService
{
    private const OPTION_KEY = 'didar_crm_contacts';

    /**
     * @return array<int, array<string, mixed>>
     */
    public function get_contacts(): array
    {
        $contacts = get_option(self::OPTION_KEY, []);
        return is_array($contacts) ? array_values($contacts) : [];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get_contact(int $id): ?array
    {
        $contacts = get_option(self::OPTION_KEY, []);
        if (is_array($contacts) && isset($contacts[$id])) {
            return $contacts[$id];
        }
        return null;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create_contact(array $data): array
    {
        $contacts = get_option(self::OPTION_KEY, []);
        if (!is_array($contacts)) {
            $contacts = [];
        }

        $next_id = empty($contacts) ? 45 : (max(array_keys($contacts)) + 1);

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $contact = [
            'id'            => $next_id,
            'first_name'    => (string) ($data['first_name'] ?? ''),
            'last_name'     => (string) ($data['last_name'] ?? ''),
            'email'         => (string) ($data['email'] ?? ''),
            'phone'         => (string) ($data['phone'] ?? ''),
            'company_id'    => isset($data['company_id']) ? (int) $data['company_id'] : null,
            'custom_fields' => !empty($data['custom_fields']) && is_array($data['custom_fields']) ? $data['custom_fields'] : [],
            'created_at'    => $now,
        ];

        $contacts[$next_id] = $contact;
        update_option(self::OPTION_KEY, $contacts);

        // Initial timeline event
        $timelineService = new TimelineService();
        $name = trim($contact['first_name'] . ' ' . $contact['last_name']);
        $timelineService->log_event('contact', $next_id, 'contact_created', "مخاطب {$name} ایجاد شد.");

        return $contact;
    }

    /**
     * Link contact to company and map custom fields, appending to activity timeline.
     *
     * @param array<string, mixed> $custom_fields
     * @return array<string, mixed>
     */
    public function link_to_company(int $contact_id, int $company_id, array $custom_fields = []): array
    {
        $contacts = get_option(self::OPTION_KEY, []);
        if (!is_array($contacts) || !isset($contacts[$contact_id])) {
            throw new \InvalidArgumentException(sprintf('Contact with ID %d not found', $contact_id));
        }

        $companyService = new CompanyService();
        $company = $companyService->get_company($company_id);
        if (!$company) {
            throw new \InvalidArgumentException(sprintf('Company with ID %d not found', $company_id));
        }

        $contact = $contacts[$contact_id];
        $contact['company_id'] = $company_id;

        $existing_fields = is_array($contact['custom_fields'] ?? null) ? $contact['custom_fields'] : [];
        $merged_fields = array_merge($existing_fields, $custom_fields);
        $contact['custom_fields'] = $merged_fields;

        $contacts[$contact_id] = $contact;
        update_option(self::OPTION_KEY, $contacts);

        // Append to activity timeline
        $timelineService = new TimelineService();
        $companyName = $company['name'] ?? 'سازمان';
        $fieldsSummary = !empty($custom_fields) ? json_encode($custom_fields, JSON_UNESCAPED_UNICODE) : '';
        $description = "اتصال به سازمان: {$companyName}";
        if ($fieldsSummary) {
            $description .= " (فیلدهای سفارشی: {$fieldsSummary})";
        }

        $timelineEvent = $timelineService->log_event(
            'contact',
            $contact_id,
            'company_linked',
            $description,
            [
                'company_id'    => $company_id,
                'company_name'  => $companyName,
                'custom_fields' => $custom_fields,
            ]
        );

        return [
            'success'        => true,
            'contact'        => $contact,
            'company'        => $company,
            'timeline_event' => $timelineEvent,
        ];
    }
}
