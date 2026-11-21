/**
 * WordPress dependencies
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test.describe('Deals Kanban Pipeline', () => {
	test('S-deals-kanban-pipeline-1: drag deal cards across stages and display rotten alert badges', async ({
		admin,
		page,
		requestUtils,
	}) => {
		// 1. Seed state through REST (RequestUtils)
		// Create a pipeline with two stages; the first stage has a 5-day rotting period
		const pipeline = await requestUtils.rest({
			method: 'POST',
			path: '/wpdev-didar-crm/v1/pipelines',
			data: {
				title: 'Sales Pipeline',
				stages: [
					{
						id: 'lead-in',
						name: 'Lead In',
						rotten_days: 5,
					},
					{
						id: 'proposal',
						name: 'Proposal',
						rotten_days: 10,
					},
				],
			},
		});

		// Seed an active deal in the "Lead In" stage (within normal threshold)
		const activeDeal = await requestUtils.rest({
			method: 'POST',
			path: '/wpdev-didar-crm/v1/deals',
			data: {
				title: 'Acme Enterprise Migration',
				amount: 25000000,
				pipeline_id: pipeline?.id ?? 1,
				stage_id: 'lead-in',
				status: 'open',
			},
		});

		// Seed a rotten deal in the "Lead In" stage (exceeding stage rotten threshold)
		const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
		const rottenDeal = await requestUtils.rest({
			method: 'POST',
			path: '/wpdev-didar-crm/v1/deals',
			data: {
				title: 'Stalled Infrastructure Overhaul',
				amount: 75000000,
				pipeline_id: pipeline?.id ?? 1,
				stage_id: 'lead-in',
				status: 'open',
				days_in_stage: 10,
				last_activity_at: tenDaysAgo,
				is_rotten: true,
			},
		});

		try {
			// 2. Navigate to Deals Kanban board
			await admin.visitAdminPage('admin.php?page=wpdev-didar-crm-deals');

			// Verify main Kanban page heading
			await expect(
				page.getByRole('heading', { name: /Deals Pipeline|Kanban/i })
			).toBeVisible();

			// 3. Verify stage columns (roles and labels)
			const leadInStage = page.getByRole('region', { name: 'Lead In' });
			const proposalStage = page.getByRole('region', { name: 'Proposal' });

			await expect(leadInStage).toBeVisible();
			await expect(proposalStage).toBeVisible();

			// 4. Verify deal cards inside the initial stage
			const activeDealCard = leadInStage.getByText('Acme Enterprise Migration');
			const rottenDealCard = leadInStage.getByText('Stalled Infrastructure Overhaul');

			await expect(activeDealCard).toBeVisible();
			await expect(rottenDealCard).toBeVisible();

			// 5. Verify rotten alert badge is displayed on the rotten deal card
			const rottenAlertBadge = leadInStage.getByRole('status', { name: /rotten/i });
			await expect(rottenAlertBadge).toBeVisible();
			await expect(rottenAlertBadge).toHaveText(/rotten/i);

			// 6. Drag active deal card from "Lead In" stage to "Proposal" stage
			await activeDealCard.dragTo(proposalStage);

			// 7. Verify observable UI updates after drag
			await expect(proposalStage.getByText('Acme Enterprise Migration')).toBeVisible();
			await expect(leadInStage.getByText('Acme Enterprise Migration')).not.toBeVisible();

			// 8. Verify persistence on page reload
			await page.reload();

			await expect(proposalStage.getByText('Acme Enterprise Migration')).toBeVisible();
			await expect(leadInStage.getByText('Acme Enterprise Migration')).not.toBeVisible();

			// Verify the rotten deal card remains in "Lead In" with its rotten alert badge
			await expect(leadInStage.getByText('Stalled Infrastructure Overhaul')).toBeVisible();
			await expect(leadInStage.getByRole('status', { name: /rotten/i })).toBeVisible();
		} finally {
			// Surgical cleanup via REST
			if (rottenDeal?.id) {
				await requestUtils
					.rest({
						method: 'DELETE',
						path: `/wpdev-didar-crm/v1/deals/${rottenDeal.id}?force=true`,
					})
					.catch(() => {});
			}
			if (activeDeal?.id) {
				await requestUtils
					.rest({
						method: 'DELETE',
						path: `/wpdev-didar-crm/v1/deals/${activeDeal.id}?force=true`,
					})
					.catch(() => {});
			}
			if (pipeline?.id) {
				await requestUtils
					.rest({
						method: 'DELETE',
						path: `/wpdev-didar-crm/v1/pipelines/${pipeline.id}?force=true`,
					})
					.catch(() => {});
			}
		}
	});
});
