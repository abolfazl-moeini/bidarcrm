<?php
declare(strict_types=1);

namespace DidarCRMTest\Deals;

use DidarCRMTest\TestCases\PluginBaseTestCase;
use DidarCRM\Modules\Deals\Services\DealService;
use DidarCRM\Modules\Deals\Services\PipelineService;

class DealsMoveTest extends PluginBaseTestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        delete_option('didar_crm_pipelines');
        delete_option('didar_crm_deals');
    }

    /**
     * @test
     */
    public function itShouldMoveDealBetweenStagesAndUpdateStageAndValue(): void
    {
        $pipelineService = new PipelineService();
        $pipeline = $pipelineService->create_pipeline([
            'title'  => 'Sales Pipeline',
            'stages' => [
                [
                    'id'              => 'lead-in',
                    'name'            => 'Lead In',
                    'rotten_days'     => 5,
                    'win_probability' => 10,
                ],
                [
                    'id'              => 'proposal',
                    'name'            => 'Proposal',
                    'rotten_days'     => 10,
                    'win_probability' => 50,
                ],
            ],
        ]);

        $this->assertNotEmpty($pipeline['id'], 'Pipeline should have an ID');

        $dealService = new DealService();
        $deal = $dealService->create_deal([
            'title'       => 'Acme Enterprise Migration',
            'amount'      => 25000000,
            'pipeline_id' => $pipeline['id'],
            'stage_id'    => 'lead-in',
            'status'      => 'open',
        ]);

        $this->assertNotEmpty($deal['id'], 'Deal should have an ID');
        $this->assertSame('lead-in', $deal['stage_id'], 'Deal should initially be in lead-in stage');
        $this->assertSame(10, $deal['win_probability'], 'Deal should have 10% win probability');

        // Move deal to proposal stage
        $updatedDeal = $dealService->move_deal((int) $deal['id'], 'proposal');

        $this->assertSame('proposal', $updatedDeal['stage_id'], 'Deal should be updated to proposal stage');
        $this->assertSame(50, $updatedDeal['win_probability'], 'Win probability should update to 50%');

        // Verify total pipeline values per stage
        $metrics = $pipelineService->get_pipeline_metrics((int) $pipeline['id']);
        $this->assertSame(0, $metrics['stages']['lead-in']['total_amount'], 'Lead-in total amount should now be 0');
        $this->assertSame(25000000, $metrics['stages']['proposal']['total_amount'], 'Proposal total amount should now be 25,000,000');
    }

    /**
     * @test
     */
    public function itShouldCalculateRottenAlertWhenDealExceedsStageThreshold(): void
    {
        $pipelineService = new PipelineService();
        $pipeline = $pipelineService->create_pipeline([
            'title'  => 'Sales Pipeline',
            'stages' => [
                [
                    'id'          => 'lead-in',
                    'name'        => 'Lead In',
                    'rotten_days' => 5,
                ],
            ],
        ]);

        $dealService = new DealService();

        // 1. Fresh deal (not rotten)
        $freshDeal = $dealService->create_deal([
            'title'            => 'Fresh Deal',
            'amount'           => 1000000,
            'pipeline_id'      => $pipeline['id'],
            'stage_id'         => 'lead-in',
            'days_in_stage'    => 2,
            'last_activity_at' => date('Y-m-d H:i:s', time() - (2 * 86400)),
        ]);
        $freshStatus = $dealService->is_rotten($freshDeal, $pipeline['stages'][0]);
        $this->assertFalse($freshStatus, 'Fresh deal under 5 days threshold should not be rotten');

        // 2. Stalled deal (rotten)
        $stalledDeal = $dealService->create_deal([
            'title'            => 'Stalled Infrastructure Overhaul',
            'amount'           => 75000000,
            'pipeline_id'      => $pipeline['id'],
            'stage_id'         => 'lead-in',
            'days_in_stage'    => 10,
            'last_activity_at' => date('Y-m-d H:i:s', time() - (10 * 86400)),
        ]);
        $rottenStatus = $dealService->is_rotten($stalledDeal, $pipeline['stages'][0]);
        $this->assertTrue($rottenStatus, 'Deal with 10 days in stage should be marked as rotten');
    }
}
