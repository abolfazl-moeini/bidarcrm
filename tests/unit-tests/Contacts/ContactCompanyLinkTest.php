<?php
declare(strict_types=1);

namespace DidarCRMTest\Contacts;

use DidarCRMTest\TestCases\PluginBaseTestCase;
use DidarCRM\Modules\Contacts\Services\CompanyService;
use DidarCRM\Modules\Contacts\Services\ContactService;
use DidarCRM\Modules\Contacts\Services\TimelineService;

class ContactCompanyLinkTest extends PluginBaseTestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        delete_option('didar_crm_companies');
        delete_option('didar_crm_contacts');
        delete_option('didar_crm_timelines');
    }

    /**
     * @test
     */
    public function itShouldCreateContactAndCompanyAndLinkThem(): void
    {
        $companyService = new CompanyService();
        $company = $companyService->create_company([
            'name'     => 'سامانه ابری دیده‌بان',
            'industry' => 'فناوری اطلاعات و ابر',
            'phone'    => '02188776655',
        ]);

        $this->assertNotEmpty($company['id'], 'Company should have an ID');
        $this->assertSame('سامانه ابری دیده‌بان', $company['name'], 'Company name should match');

        $contactService = new ContactService();
        $contact = $contactService->create_contact([
            'first_name' => 'سهراب',
            'last_name'  => 'سپهری',
            'email'      => 'sohrab@example.com',
            'phone'      => '09121234567',
        ]);

        $this->assertNotEmpty($contact['id'], 'Contact should have an ID');
        $this->assertNull($contact['company_id'] ?? null, 'Contact should initially have no company');

        // Link contact to company with custom fields
        $linkResult = $contactService->link_to_company(
            (int) $contact['id'],
            (int) $company['id'],
            [
                'role'     => 'مدیر ارشد فناوری (CTO)',
                'industry' => 'Technology',
            ]
        );

        $this->assertTrue($linkResult['success'], 'Linking should return success true');
        $this->assertSame((int) $company['id'], $linkResult['contact']['company_id'], 'Contact company_id should match');
        $this->assertSame('مدیر ارشد فناوری (CTO)', $linkResult['contact']['custom_fields']['role'], 'Role custom field should be saved');

        // Verify timeline log event was automatically created
        $timelineService = new TimelineService();
        $events = $timelineService->get_timeline('contact', (int) $contact['id']);

        $this->assertNotEmpty($events, 'Timeline should have at least one event');
        $lastEvent = $events[0];
        $this->assertSame('company_linked', $lastEvent['type'], 'Event type should be company_linked');
        $this->assertStringContainsString('سامانه ابری دیده‌بان', $lastEvent['description'], 'Event description should mention company name');
    }

    /**
     * @test
     */
    public function itShouldThrowExceptionWhenLinkingNonExistentContactOrCompany(): void
    {
        $contactService = new ContactService();

        $this->expectException(\InvalidArgumentException::class);
        $contactService->link_to_company(9999, 12, []);
    }
}
