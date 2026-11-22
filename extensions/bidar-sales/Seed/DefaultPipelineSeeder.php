<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Seed;

class DefaultPipelineSeeder
{
    /**
     * @return array{name: string, stages: list<array{name: string, rottenDays: ?int, probability: int|string}>}
     */
    public function getDefaultPipelineDefinition(): array
    {
        return [
            'name' => 'کاریز اصلی فروش',
            'stages' => [
                [
                    'name' => 'تماس اولیه',
                    'rottenDays' => 3,
                    'probability' => 20,
                ],
                [
                    'name' => 'پیگیری و مذاکره',
                    'rottenDays' => 5,
                    'probability' => 50,
                ],
                [
                    'name' => 'ارسال پیش‌فاکتور',
                    'rottenDays' => 4,
                    'probability' => 80,
                ],
                [
                    'name' => 'موفق (برنده)',
                    'rottenDays' => null,
                    'probability' => 'Closed Won',
                ],
                [
                    'name' => 'ناموفق (از دست رفته)',
                    'rottenDays' => null,
                    'probability' => 'Closed Lost',
                ],
            ],
        ];
    }
}
