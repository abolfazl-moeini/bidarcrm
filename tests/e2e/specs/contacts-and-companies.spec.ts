/**
 * WordPress dependencies
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test.describe('Contacts and Companies Management', () => {
	test('S-contacts-and-companies-management-1: link contact to company and view unified timeline update', async ({
		admin,
		page,
		requestUtils,
	}) => {
		// 1. Seed Company via REST
		const company = await requestUtils.rest({
			method: 'POST',
			path: '/wpdev-didar-crm/v1/companies',
			data: {
				name: 'سامانه ابری دیده‌بان',
				industry: 'فناوری اطلاعات و ابر',
				phone: '02188776655',
			},
		});

		// 2. Seed Contact via REST
		const contact = await requestUtils.rest({
			method: 'POST',
			path: '/wpdev-didar-crm/v1/contacts',
			data: {
				first_name: 'سهراب',
				last_name: 'سپهری',
				email: 'sohrab@example.com',
				phone: '09121234567',
			},
		});

		const contactId = contact?.id ?? 45;
		const companyId = company?.id ?? 12;

		// 3. Link Contact to Company with custom fields via REST
		const linkResult = await requestUtils.rest({
			method: 'POST',
			path: `/wpdev-didar-crm/v1/contacts/${contactId}/link`,
			data: {
				company_id: companyId,
				custom_fields: {
					role: 'مدیر ارشد فناوری (CTO)',
					industry: 'Technology',
				},
			},
		});

		expect(linkResult?.success).toBe(true);
		expect(linkResult?.contact?.company_id).toBe(companyId);

		// 4. Navigate to Contact Detail Profile View
		await admin.visitAdminPage(`admin.php?page=didar-contacts&id=${contactId}`);

		// 5. Verify Contact Profile Heading & Details
		await expect(
			page.getByRole('heading', { name: /سهراب سپهری|پروفایل مخاطب/i })
		).toBeVisible();

		// 6. Verify Associated Company is visible in Profile Sidebar
		await expect(page.getByText('سامانه ابری دیده‌بان')).toBeVisible();

		// 7. Verify Unified Activity Timeline is present and shows the link event
		const timeline = page.locator('#activity-timeline');
		await expect(timeline).toBeVisible();
		await expect(timeline.getByText(/سامانه ابری دیده‌بان|اتصال به سازمان/i)).toBeVisible();
		await expect(timeline.getByText(/مدیر ارشد فناوری \(CTO\)|Technology/i)).toBeVisible();
	});
});
