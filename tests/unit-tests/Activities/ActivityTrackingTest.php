<?php
declare(strict_types=1);

namespace DidarCRMTest\Activities;

use DidarCRMTest\TestCases\PluginBaseTestCase;
use DidarCRM\Modules\Activities\Services\ActivityService;

class ActivityTrackingTest extends PluginBaseTestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        delete_option('didar_crm_activities');
    }

    /**
     * @test
     */
    public function itShouldCreateActivitiesWithTypesAndDueDates(): void
    {
        $service = new ActivityService();

        $activity = $service->create_activity([
            'title'     => 'تماس تلفنی پیگیری قرارداد سرور ابری',
            'type'      => 'call',
            'due_date'  => '2026-11-25',
            'status'    => 'pending',
            'priority'  => 'high',
        ]);

        $this->assertNotEmpty($activity['id'], 'Activity should have an ID');
        $this->assertSame('call', $activity['type'], 'Activity type should match');
        $this->assertSame('pending', $activity['status'], 'Initial status should be pending');
    }

    /**
     * @test
     */
    public function itShouldToggleActivityCompletion(): void
    {
        $service = new ActivityService();

        $activity = $service->create_activity([
            'title'    => 'جلسه دمو حضوری با هلدینگ پارس',
            'type'     => 'meeting',
            'due_date' => '2026-11-25',
            'status'   => 'pending',
        ]);

        // Toggle to completed
        $updated = $service->update_status((int) $activity['id'], 'completed');
        $this->assertSame('completed', $updated['status'], 'Status should now be completed');
        $this->assertNotEmpty($updated['completed_at'], 'completed_at timestamp should be set');

        // Toggle back to pending
        $reverted = $service->update_status((int) $activity['id'], 'pending');
        $this->assertSame('pending', $reverted['status'], 'Status should be reverted to pending');
        $this->assertNull($reverted['completed_at'], 'completed_at should be null when pending');
    }

    /**
     * @test
     */
    public function itShouldRetrieveActivitiesGroupedByDueDateForCalendar(): void
    {
        $service = new ActivityService();

        $service->create_activity(['title' => 'Task A', 'type' => 'task', 'due_date' => '2026-11-25']);
        $service->create_activity(['title' => 'Call B', 'type' => 'call', 'due_date' => '2026-11-25']);
        $service->create_activity(['title' => 'Meeting C', 'type' => 'meeting', 'due_date' => '2026-11-26']);

        $grouped = $service->get_calendar_events('2026-11-25', '2026-11-26');
        $this->assertArrayHasKey('2026-11-25', $grouped, 'Grouped events should have date key 2026-11-25');
        $this->assertCount(2, $grouped['2026-11-25'], 'There should be 2 events on 2026-11-25');
        $this->assertCount(1, $grouped['2026-11-26'], 'There should be 1 event on 2026-11-26');
    }
}
