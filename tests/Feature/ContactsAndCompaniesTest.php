<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Contact;
use App\Models\TimelineEvent;
use App\Services\TimelineService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactsAndCompaniesTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_companies_and_contacts_via_api(): void
    {
        // 1. Create a Company via API
        $companyPayload = [
            'name' => 'شرکت فناوری داده‌ورزان دیدار',
            'industry' => 'فناوری اطلاعات و نرم‌افزار',
            'phone' => '02188776655',
            'website' => 'https://didar.me',
            'address' => 'تهران، میدان ونک، خیابان ولیعصر، برج دیدار',
            'custom_fields' => [
                'national_id' => '10103847582',
                'company_tier' => 'سازمانی (Enterprise)',
                'employee_count' => 120,
            ],
        ];

        $companyResponse = $this->postJson('/api/companies', $companyPayload);

        $companyResponse->assertStatus(201)
            ->assertJsonPath('data.name', 'شرکت فناوری داده‌ورزان دیدار')
            ->assertJsonPath('data.industry', 'فناوری اطلاعات و نرم‌افزار')
            ->assertJsonPath('data.custom_fields.national_id', '10103847582');

        $this->assertDatabaseHas('companies', [
            'name' => 'شرکت فناوری داده‌ورزان دیدار',
            'phone' => '02188776655',
        ]);

        $companyId = $companyResponse->json('data.id');

        // 2. Create a Contact via API
        $contactPayload = [
            'first_name' => 'سهراب',
            'last_name' => 'سپهری',
            'email' => 'sohrab.sepehri@didar.me',
            'phone' => '09123456789',
            'job_title' => 'مدیر فروش و توسعه بازار',
            'company_id' => $companyId,
            'custom_fields' => [
                'preferred_channel' => 'telegram',
                'lead_source' => 'نمایشگاه بین‌المللی',
            ],
        ];

        $contactResponse = $this->postJson('/api/contacts', $contactPayload);

        $contactResponse->assertStatus(201)
            ->assertJsonPath('data.first_name', 'سهراب')
            ->assertJsonPath('data.last_name', 'سپهری')
            ->assertJsonPath('data.email', 'sohrab.sepehri@didar.me')
            ->assertJsonPath('data.company_id', $companyId)
            ->assertJsonPath('data.custom_fields.preferred_channel', 'telegram');

        $this->assertDatabaseHas('contacts', [
            'first_name' => 'سهراب',
            'last_name' => 'سپهری',
            'email' => 'sohrab.sepehri@didar.me',
            'company_id' => $companyId,
        ]);
    }

    public function test_it_links_contact_to_company_with_custom_fields_and_logs_timeline(): void
    {
        $company = Company::create([
            'name' => 'هلدینگ سرمایه‌گذاری پارس',
            'industry' => 'سرمایه‌گذاری مالی',
            'phone' => '02122334455',
            'website' => 'https://pars-holding.ir',
            'address' => 'تهران، بلوار نلسون ماندلا',
        ]);

        $contact = Contact::create([
            'first_name' => 'نیلوفر',
            'last_name' => 'قاسمی',
            'email' => 'niloufar.ghasemi@example.com',
            'phone' => '09129876543',
            'job_title' => 'مشاور فنی',
            'custom_fields' => [
                'language' => 'fa',
            ],
        ]);

        $linkPayload = [
            'company_id' => $company->id,
            'job_title' => 'مدیر ارشد تحول دیجیتال',
            'custom_fields' => [
                'department' => 'فناوری و تحول دیجیتال',
                'vip_level' => 'طلایی (VIP A+)',
            ],
        ];

        $response = $this->postJson("/api/contacts/{$contact->id}/link", $linkPayload);

        $response->assertStatus(200)
            ->assertJsonPath('data.company_id', $company->id)
            ->assertJsonPath('data.job_title', 'مدیر ارشد تحول دیجیتال')
            ->assertJsonPath('data.company.name', 'هلدینگ سرمایه‌گذاری پارس')
            ->assertJsonPath('data.custom_fields.department', 'فناوری و تحول دیجیتال')
            ->assertJsonPath('data.custom_fields.language', 'fa');

        $contact->refresh();
        $this->assertEquals($company->id, $contact->company_id);
        $this->assertEquals('مدیر ارشد تحول دیجیتال', $contact->job_title);
        $this->assertEquals('فناوری و تحول دیجیتال', $contact->custom_fields['department'] ?? null);
        $this->assertEquals('fa', $contact->custom_fields['language'] ?? null);

        // Assert timeline event record was automatically generated
        $this->assertDatabaseHas('timeline_events', [
            'timelineable_type' => Contact::class,
            'timelineable_id' => $contact->id,
            'type' => 'company_linked',
        ]);

        $timelineEvent = TimelineEvent::where('timelineable_type', Contact::class)
            ->where('timelineable_id', $contact->id)
            ->where('type', 'company_linked')
            ->first();

        $this->assertNotNull($timelineEvent);
        $this->assertStringContainsString('هلدینگ سرمایه‌گذاری پارس', $timelineEvent->description);
        $this->assertEquals($company->id, $timelineEvent->meta['company_id'] ?? null);
    }

    public function test_it_retrieves_unified_activity_timeline_for_contact(): void
    {
        $company = Company::create([
            'name' => 'نوآوران پایا',
            'industry' => 'خدمات ابری',
        ]);

        $contact = Contact::create([
            'company_id' => $company->id,
            'first_name' => 'داریوش',
            'last_name' => 'مهرجویی',
            'email' => 'dariush@paya-cloud.com',
            'phone' => '09351112233',
            'job_title' => 'مدیر زیرساخت',
        ]);

        $timelineService = app(TimelineService::class);
        $baseTime = Carbon::now();

        // Log events at distinct timestamps
        Carbon::setTestNow($baseTime->copy()->subHours(5));
        $timelineService->log($contact, 'contact_created', 'مخاطب جدید در سیستم ثبت شد.');

        Carbon::setTestNow($baseTime->copy()->subHours(3));
        $timelineService->log($contact, 'company_linked', 'مخاطب به سازمان نوآوران پایا پیوند داده شد.', [
            'company_id' => $company->id,
            'company_name' => $company->name,
        ]);

        Carbon::setTestNow($baseTime->copy()->subHour());
        $timelineService->log($contact, 'phone_call', 'تماس خروجی با مخاطب جهت نیازسنجی سرور ابری برقرار شد.', [
            'duration_minutes' => 14,
            'outcome' => 'موفق و پیگیری جلسه دمو',
        ]);

        Carbon::setTestNow(); // reset

        $response = $this->getJson("/api/contacts/{$contact->id}/timeline");

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.type', 'phone_call')
            ->assertJsonPath('data.1.type', 'company_linked')
            ->assertJsonPath('data.2.type', 'contact_created');
    }

    public function test_it_renders_contact_profile_view_with_company_and_timeline(): void
    {
        $company = Company::create([
            'name' => 'صنایع ارتباطات نوین سپهر',
            'industry' => 'مخابرات و شبکه',
            'phone' => '02188990011',
            'website' => 'https://sepehr-telecom.ir',
            'address' => 'تهران، خیابان شریعتی',
        ]);

        $contact = Contact::create([
            'company_id' => $company->id,
            'first_name' => 'کوروش',
            'last_name' => 'بزرگمهر',
            'email' => 'kourosh@sepehr-telecom.ir',
            'phone' => '09121113355',
            'job_title' => 'معاونت فنی و مهندسی',
            'custom_fields' => [
                'department' => 'فنی و مهندسی',
                'decision_maker' => 'بله - تصمیم‌گیرنده نهایی',
            ],
        ]);

        $timelineService = app(TimelineService::class);
        $timelineService->log($contact, 'company_linked', 'مخاطب به سازمان صنایع ارتباطات نوین سپهر متصل گردید.');
        $timelineService->log($contact, 'meeting_logged', 'جلسه حضوری معارفه راهکارهای CRM با تیم فنی برگزار شد.');

        $response = $this->get("/contacts/{$contact->id}");

        $response->assertStatus(200);
        $response->assertSee('کوروش بزرگمهر');
        $response->assertSee('صنایع ارتباطات نوین سپهر');
        $response->assertSee('معاونت فنی و مهندسی');
        $response->assertSee('decision_maker');
        $response->assertSee('بله - تصمیم‌گیرنده نهایی');
        $response->assertSee('id="activity-timeline"', false);
        $response->assertSee('جلسه حضوری معارفه راهکارهای CRM با تیم فنی برگزار شد.');
        $response->assertSee('dir="rtl"', false);
        $response->assertSee('lang="fa"', false);
    }

    public function test_it_renders_contacts_index_view(): void
    {
        $company = Company::create([
            'name' => 'توسعه فناوری پارسیان',
            'industry' => 'فناوری مالی',
        ]);

        $contact = Contact::create([
            'company_id' => $company->id,
            'first_name' => 'آرش',
            'last_name' => 'کمانگیر',
            'email' => 'arash@parsian.ir',
            'phone' => '09125556677',
            'job_title' => 'مدیر محصول',
        ]);

        $response = $this->get('/contacts');

        $response->assertStatus(200);
        $response->assertSee('مدیریت مخاطبان و سازمان‌ها');
        $response->assertSee('آرش کمانگیر');
        $response->assertSee('توسعه فناوری پارسیان');
        $response->assertSee('09125556677');
        $response->assertSee('مدیر محصول');
    }
}
