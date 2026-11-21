<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Contacts\Services;

class CompanyService
{
    private const OPTION_KEY = 'didar_crm_companies';

    /**
     * @return array<int, array<string, mixed>>
     */
    public function get_companies(): array
    {
        $companies = get_option(self::OPTION_KEY, []);
        return is_array($companies) ? array_values($companies) : [];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get_company(int $id): ?array
    {
        $companies = get_option(self::OPTION_KEY, []);
        if (is_array($companies) && isset($companies[$id])) {
            return $companies[$id];
        }
        return null;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create_company(array $data): array
    {
        $companies = get_option(self::OPTION_KEY, []);
        if (!is_array($companies)) {
            $companies = [];
        }

        $next_id = empty($companies) ? 12 : (max(array_keys($companies)) + 1);

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $company = [
            'id'         => $next_id,
            'name'       => (string) ($data['name'] ?? 'Untitled Company'),
            'industry'   => (string) ($data['industry'] ?? ''),
            'phone'      => (string) ($data['phone'] ?? ''),
            'website'    => (string) ($data['website'] ?? ''),
            'address'    => (string) ($data['address'] ?? ''),
            'created_at' => $now,
        ];

        $companies[$next_id] = $company;
        update_option(self::OPTION_KEY, $companies);

        return $company;
    }
}
