<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Pipeline;
use App\Models\Stage;
use App\Models\User;
use App\Services\DealService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DealsKanbanTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_pipelines_with_stages_and_rotten_thresholds(): void
    {
        $payload = [
            'name' => 'پایپ‌لاین فروش مستقیم',
            'stages' => [
                [
                    'name' => 'تماس اولیه',
                    'slug' => 'first-contact',
                    'order' => 1,
                    'rotten_days' => 3,
                    'win_probability' => 20,
                ],
                [
                    'name' => 'ارائه پروپوزال',
                    'slug' => 'proposal',
                    'order' => 2,
                    'rotten_days' => 5,
                    'win_probability' => 60,
                ],
                [
                    'name' => 'بسته شده - موفق',
                    'slug' => 'won',
                    'order' => 3,
                    'rotten_days' => 0,
                    'win_probability' => 100,
                ],
            ],
        ];

        $response = $this->postJson('/api/pipelines', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.name', 'پایپ‌لاین فروش مستقیم')
            ->assertJsonCount(3, 'data.stages');

        $this->assertDatabaseHas('pipelines', [
            'name' => 'پایپ‌لاین فروش مستقیم',
        ]);

        $this->assertDatabaseHas('stages', [
            'name' => 'تماس اولیه',
            'rotten_days' => 3,
            'win_probability' => 20,
        ]);
        $this->assertDatabaseHas('stages', [
            'name' => 'ارائه پروپوزال',
            'rotten_days' => 5,
            'win_probability' => 60,
        ]);
    }

    public function test_it_moves_deal_between_stages_and_updates_win_probability_and_metrics(): void
    {
        $pipeline = Pipeline::create(['name' => 'فروش شرکتی']);
        $stage1 = Stage::create([
            'pipeline_id' => $pipeline->id,
            'name' => 'تماس اولیه',
            'slug' => 'lead',
            'order' => 1,
            'rotten_days' => 3,
            'win_probability' => 20,
        ]);
        $stage2 = Stage::create([
            'pipeline_id' => $pipeline->id,
            'name' => 'مذاکره نهایی',
            'slug' => 'negotiation',
            'order' => 2,
            'rotten_days' => 7,
            'win_probability' => 80,
        ]);

        $deal = Deal::create([
            'pipeline_id' => $pipeline->id,
            'stage_id' => $stage1->id,
            'title' => 'قرارداد خرید لایسنس دیدار',
            'amount' => 150000000,
            'status' => 'open',
            'win_probability' => 20,
            'stage_entered_at' => Carbon::now()->subDays(4),
            'days_in_stage' => 4,
            'last_activity_at' => Carbon::now()->subDays(4),
            'is_rotten' => true,
        ]);

        $response = $this->postJson("/api/deals/{$deal->id}/move", [
            'stage_id' => $stage2->id,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.stage_id', $stage2->id)
            ->assertJsonPath('data.win_probability', 80)
            ->assertJsonPath('data.is_rotten', false);

        $deal->refresh();
        $this->assertEquals($stage2->id, $deal->stage_id);
        $this->assertEquals(80, $deal->win_probability);
        $this->assertFalse((bool) $deal->is_rotten);
        $this->assertEquals(0, $deal->days_in_stage);
        $this->assertNotNull($deal->stage_entered_at);
        $this->assertTrue(Carbon::parse($deal->stage_entered_at)->diffInSeconds(Carbon::now()) < 10);
    }

    public function test_it_calculates_rotten_alert_when_deal_days_in_stage_exceeds_threshold(): void
    {
        $pipeline = Pipeline::create(['name' => 'پایپ‌لاین خدمات']);
        $stage = Stage::create([
            'pipeline_id' => $pipeline->id,
            'name' => 'بررسی فنی',
            'slug' => 'tech-review',
            'order' => 1,
            'rotten_days' => 4,
            'win_probability' => 30,
        ]);

        // Deal 1: 5 days in stage, threshold is 4 -> ROTTEN
        $rottenDeal = Deal::create([
            'pipeline_id' => $pipeline->id,
            'stage_id' => $stage->id,
            'title' => 'پروژه اتوماسیون صنعتی',
            'amount' => 75000000,
            'status' => 'open',
            'win_probability' => 30,
            'stage_entered_at' => Carbon::now()->subDays(5),
            'days_in_stage' => 0,
            'is_rotten' => false,
        ]);

        // Deal 2: 2 days in stage, threshold is 4 -> FRESH
        $freshDeal = Deal::create([
            'pipeline_id' => $pipeline->id,
            'stage_id' => $stage->id,
            'title' => 'سفارش پشتیبانی سالانه',
            'amount' => 25000000,
            'status' => 'open',
            'win_probability' => 30,
            'stage_entered_at' => Carbon::now()->subDays(2),
            'days_in_stage' => 0,
            'is_rotten' => false,
        ]);

        $dealService = app(DealService::class);
        $dealService->recalculateRottenThresholds();

        $rottenDeal->refresh();
        $freshDeal->refresh();

        $this->assertTrue((bool) $rottenDeal->is_rotten);
        $this->assertGreaterThanOrEqual(4, $rottenDeal->days_in_stage);

        $this->assertFalse((bool) $freshDeal->is_rotten);
        $this->assertEquals(2, $freshDeal->days_in_stage);

        // Also test GET /api/deals returns updated rotten status
        $response = $this->getJson("/api/deals?pipeline_id={$pipeline->id}");
        $response->assertStatus(200)
            ->assertJsonFragment([
                'id' => $rottenDeal->id,
                'is_rotten' => true,
            ])
            ->assertJsonFragment([
                'id' => $freshDeal->id,
                'is_rotten' => false,
            ]);
    }
}
