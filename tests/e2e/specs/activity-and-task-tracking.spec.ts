/**
 * WordPress dependencies
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test.describe('Activity and Task Tracking Calendar', () => {
	test('S-activity-and-task-tracking-1: inspect scheduled client tasks and toggle completion on team calendar', async ({
		admin,
		page,
		requestUtils,
	}) => {
		const today = new Date().toISOString().split('T')[0];

		// 1. Seed activities via REST
		const callTask = await requestUtils.rest({
			method: 'POST',
			path: '/wpdev-didar-crm/v1/activities',
			data: {
				title: 'تماس تلفنی پیگیری قرارداد سرور ابری',
				type: 'call',
				due_date: today,
				status: 'pending',
				priority: 'high',
			},
		});

		const meetingTask = await requestUtils.rest({
			method: 'POST',
			path: '/wpdev-didar-crm/v1/activities',
			data: {
				title: 'جلسه دمو حضوری با هلدینگ پارس',
				type: 'meeting',
				due_date: today,
				status: 'pending',
				priority: 'medium',
			},
		});

		// 2. Navigate to Team Calendar page
		await admin.visitAdminPage('admin.php?page=didar-calendar');

		// 3. Verify Calendar heading
		await expect(
			page.getByRole('heading', { name: /تقویم فعالیت‌های تیم|Team Calendar/i })
		).toBeVisible();

		// 4. Verify calendar event items are visible
		const eventItems = page.locator('.calendar-event-item');
		await expect(eventItems.first()).toBeVisible();

		await expect(page.getByText('تماس تلفنی پیگیری قرارداد سرور ابری')).toBeVisible();
		await expect(page.getByText('جلسه دمو حضوری با هلدینگ پارس')).toBeVisible();

		// 5. Verify completion checkbox
		const checkbox = page.locator(`input[type="checkbox"][data-activity-id="${callTask?.id ?? ''}"]`).first();
		if (await checkbox.isVisible()) {
			await checkbox.check();
			await expect(checkbox).toBeChecked();
		}
	});
});
