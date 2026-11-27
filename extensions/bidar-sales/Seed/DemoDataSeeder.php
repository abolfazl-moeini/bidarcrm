<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Seed;

use Espo\ORM\Entity;
use Espo\ORM\EntityManager;

class DemoDataSeeder
{
    public function __construct(
        private EntityManager $entityManager
    ) {
    }

    /**
     * Seeds realistic Persian B2B demo data for BidarCRM.
     * Fully idempotent: can be executed multiple times without creating duplicates.
     *
     * @param string|null $assignedUserId Admin user ID to assign records to
     * @param callable|null $logger Optional callback for progress logging fn(string $msg): void
     * @return array<string, int> Summary of seeded entity counts
     */
    public function seed(?string $assignedUserId = null, ?callable $logger = null): array
    {
        $this->log($logger, "شروع فرایند ایجاد داده‌های نمونه کسب‌وکار بیدار (BidarCRM)...");

        // 1. کاریز اصلی فروش و مراحل کاریز
        $pipelineData = $this->seedPipelineAndStages($logger);
        $pipeline = $pipelineData['pipeline'];
        $stageMap = $pipelineData['stageMap'];

        // 2. شرکت‌ها و مشتریان سازمانی (Accounts)
        $accountEntities = $this->seedAccounts($assignedUserId, $logger);

        // 3. مخاطبان کلیدی (Contacts)
        $contactEntities = $this->seedContacts($accountEntities, $assignedUserId, $logger);

        // 4. محصولات پایه بیدار (BidarProduct)
        $productEntities = $this->seedProducts($logger);

        // 5. فرصت‌ها و معاملات کاریز فروش (Opportunities: 6 active + 1 rotten + 1 closed lost)
        $rottenLastActivityAt = date('Y-m-d H:i:s', strtotime('-10 days'));
        $oppEntities = $this->seedOpportunities($pipeline, $stageMap, $accountEntities, $contactEntities, $assignedUserId, $logger);

        // 6. اقلام معامله (BidarDealItem)
        $dealItemEntities = $this->seedDealItems($oppEntities, $productEntities, $logger);

        // 7. هدف فروش ماهانه شمسی (BidarGoal)
        $goalEntities = $this->seedSalesGoal($assignedUserId, $logger);

        // 8. قالب‌های پیامک (BidarSmsTemplate)
        $smsEntities = $this->seedSmsTemplates($logger);

        // 9. وظایف کاری (Tasks)
        $taskEntities = $this->seedTasks($oppEntities, $assignedUserId, $logger);

        // 10. تماس‌ها (Calls)
        $callEntities = $this->seedCalls($oppEntities, $assignedUserId, $logger);

        // 11. جلسات تقویم (Meetings)
        $meetingEntities = $this->seedMeetings($oppEntities, $assignedUserId, $logger);

        // 12. سرنخ‌های فروش (Leads)
        $leadEntities = $this->seedLeads($assignedUserId, $logger);

        // 13. یادداشت‌های استریم ۳۶۰ درجه (Stream Notes)
        $noteEntities = $this->seedNotes($oppEntities, $assignedUserId, $logger);

        // Preserve sample rotten deal's aged lastActivityAt after Task/Note hooks
        if (isset($oppEntities['zist_rotten_deal']) && $rottenLastActivityAt !== null) {
            $rottenOpp = $oppEntities['zist_rotten_deal'];
            $rottenOpp->set('lastActivityAt', $rottenLastActivityAt);
            $this->entityManager->saveEntity($rottenOpp, [
                'silent' => true,
                'skipHooks' => true,
            ]);
        }

        $summary = [
            'pipelines' => 1,
            'pipelineStages' => count($stageMap),
            'accounts' => count($accountEntities),
            'contacts' => count($contactEntities),
            'opportunities' => count($oppEntities),
            'tasks' => count($taskEntities),
            'calls' => count($callEntities),
            'meetings' => count($meetingEntities),
            'leads' => count($leadEntities),
            'products' => count($productEntities),
            'dealItems' => count($dealItemEntities),
            'goals' => count($goalEntities),
            'smsTemplates' => count($smsEntities),
            'notes' => count($noteEntities),
        ];

        $this->log($logger, "پایان عملیات ایجاد داده‌های نمونه بیدار با موفقیت.");

        return $summary;
    }

    private function log(?callable $logger, string $message): void
    {
        if ($logger !== null) {
            $logger($message);
        }
    }

    /**
     * @return array{pipeline: Entity, stageMap: array<string, Entity>}
     */
    private function seedPipelineAndStages(?callable $logger): array
    {
        $this->log($logger, "۱. راه‌اندازی کاریز اصلی فروش و مراحل کاریز...");
        $pipelineRepo = $this->entityManager->getRepository('Pipeline');
        $pipeline = $pipelineRepo->where(['name' => 'کاریز اصلی فروش'])->findOne();

        if (!$pipeline) {
            $pipeline = $this->entityManager->createEntity('Pipeline', [
                'name' => 'کاریز اصلی فروش',
                'entityType' => 'Opportunity',
                'field' => 'stage',
                'isAvailableForAll' => true,
            ]);
            $this->log($logger, "   [+] کاریز «کاریز اصلی فروش» ایجاد شد.");
        }

        $stagesConfig = [
            ['name' => 'تماس اولیه', 'mappedStatus' => 'Prospecting', 'order' => 0, 'rottenDays' => 3],
            ['name' => 'پیگیری و مذاکره', 'mappedStatus' => 'Qualification', 'order' => 1, 'rottenDays' => 5],
            ['name' => 'ارسال پیش‌فاکتور', 'mappedStatus' => 'Proposal', 'order' => 2, 'rottenDays' => 4],
            ['name' => 'مذاکره نهایی', 'mappedStatus' => 'Negotiation', 'order' => 3, 'rottenDays' => 5],
            ['name' => 'موفق (برنده)', 'mappedStatus' => 'Closed Won', 'order' => 4, 'rottenDays' => null],
            ['name' => 'ناموفق (از دست رفته)', 'mappedStatus' => 'Closed Lost', 'order' => 5, 'rottenDays' => null],
        ];

        $stageRepo = $this->entityManager->getRepository('PipelineStage');
        $stageMap = [];

        foreach ($stagesConfig as $cfg) {
            $stage = $stageRepo->where([
                'pipelineId' => $pipeline->getId(),
                'name' => $cfg['name'],
            ])->findOne();

            if (!$stage) {
                $stage = $this->entityManager->createEntity('PipelineStage', [
                    'name' => $cfg['name'],
                    'pipelineId' => $pipeline->getId(),
                    'mappedStatus' => $cfg['mappedStatus'],
                    'order' => $cfg['order'],
                    'rottenDays' => $cfg['rottenDays'],
                ]);
                $this->log($logger, "   [+] مرحله «{$cfg['name']}» ایجاد شد.");
            }
            $stageMap[$cfg['mappedStatus']] = $stage;
        }

        return ['pipeline' => $pipeline, 'stageMap' => $stageMap];
    }

    /**
     * @return array<string, Entity>
     */
    private function seedAccounts(?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۲. ایجاد شرکت‌ها و مشتریان سازمانی (Accounts)...");
        $accountsData = [
            'kimia' => [
                'name' => 'فناوران داده‌پرداز کیمیا',
                'industry' => 'Technology',
                'type' => 'Customer',
                'phoneNumber' => '02188776655',
                'emailAddress' => 'info@kimiadata.ir',
                'website' => 'https://kimiadata.ir',
                'billingAddressCity' => 'تهران',
                'customerGroups' => ['VIP', 'Loyal'],
            ],
            'zarrin' => [
                'name' => 'صنایع غذایی زرین‌دشت',
                'industry' => 'Food & Beverage',
                'type' => 'Customer',
                'phoneNumber' => '03132211440',
                'emailAddress' => 'sales@zarrindasht.com',
                'website' => 'https://zarrindasht.com',
                'billingAddressCity' => 'اصفهان',
                'customerGroups' => ['Loyal'],
            ],
            'sepehr' => [
                'name' => 'پتروشیمی سپهر خلیج فارس',
                'industry' => 'Chemicals',
                'type' => 'Customer',
                'phoneNumber' => '07737229988',
                'emailAddress' => 'crm@sepehr-pg.ir',
                'website' => 'https://sepehr-pg.ir',
                'billingAddressCity' => 'عسلویه',
                'customerGroups' => ['VIP'],
            ],
            'baran' => [
                'name' => 'توسعه تجارت الکترونیک باران',
                'industry' => 'Retail',
                'type' => 'Customer',
                'phoneNumber' => '02144556677',
                'emailAddress' => 'contact@baran-commerce.com',
                'website' => 'https://baran-commerce.com',
                'billingAddressCity' => 'تهران',
                'customerGroups' => ['FirstPurchase'],
            ],
            'zist' => [
                'name' => 'گروه دارویی زیست‌یار نوین',
                'industry' => 'Pharmaceuticals',
                'type' => 'Customer',
                'phoneNumber' => '05138401122',
                'emailAddress' => 'support@zistyarnovin.ir',
                'website' => 'https://zistyarnovin.ir',
                'billingAddressCity' => 'مشهد',
                'customerGroups' => ['Exhibition'],
            ],
            'arya' => [
                'name' => 'فولاد و نورد آریا گستر',
                'industry' => 'Manufacturing',
                'type' => 'Customer',
                'phoneNumber' => '06133344550',
                'emailAddress' => 'office@aryasteel.ir',
                'website' => 'https://aryasteel.ir',
                'billingAddressCity' => 'اهواز',
                'customerGroups' => ['Reseller'],
            ],
        ];

        $accountEntities = [];
        $accountRepo = $this->entityManager->getRepository('Account');

        foreach ($accountsData as $key => $data) {
            $acc = $accountRepo->where(['name' => $data['name']])->findOne();
            if (!$acc) {
                $insertData = $data;
                if ($assignedUserId !== null) {
                    $insertData['assignedUserId'] = $assignedUserId;
                }
                $acc = $this->entityManager->createEntity('Account', $insertData);
                $this->log($logger, "   [+] شرکت «{$data['name']}» ایجاد شد.");
            } elseif ($assignedUserId !== null && !$acc->get('assignedUserId')) {
                $acc->set('assignedUserId', $assignedUserId);
                $this->entityManager->saveEntity($acc);
            }
            $accountEntities[$key] = $acc;
        }

        return $accountEntities;
    }

    /**
     * @param array<string, Entity> $accountEntities
     * @return array<string, Entity>
     */
    private function seedContacts(array $accountEntities, ?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۳. ایجاد مخاطبان و تصمیم‌گیرندگان کلیدی (Contacts)...");
        $contactsData = [
            'kimia' => [
                'firstName' => 'علیرضا',
                'lastName' => 'سلیمانی',
                'title' => 'مدیر ارشد فناوری (CTO)',
                'phoneNumber' => '09121112233',
                'emailAddress' => 'a.soleimani@kimiadata.ir',
                'customerGroups' => ['VIP'],
            ],
            'zarrin' => [
                'firstName' => 'مریم',
                'lastName' => 'انصاری',
                'title' => 'مدیر تامین و بازرگانی',
                'phoneNumber' => '09132223344',
                'emailAddress' => 'ansari@zarrindasht.com',
                'customerGroups' => ['Loyal'],
            ],
            'sepehr' => [
                'firstName' => 'احسان',
                'lastName' => 'قادری',
                'title' => 'رئیس پشتیبانی سیستم‌ها',
                'phoneNumber' => '09173334455',
                'emailAddress' => 'e.ghaderi@sepehr-pg.ir',
                'customerGroups' => ['VIP'],
            ],
            'baran' => [
                'firstName' => 'بهزاد',
                'lastName' => 'مرادی',
                'title' => 'معاون عملیات و لجستیک',
                'phoneNumber' => '09124445566',
                'emailAddress' => 'b.moradi@baran-commerce.com',
                'customerGroups' => ['FirstPurchase'],
            ],
            'zist' => [
                'firstName' => 'سپیده',
                'lastName' => 'رادفر',
                'title' => 'مدیر تضمین کیفیت و استاندارد',
                'phoneNumber' => '09155556677',
                'emailAddress' => 's.radfar@zistyarnovin.ir',
                'customerGroups' => ['Exhibition'],
            ],
            'arya' => [
                'firstName' => 'کوروش',
                'lastName' => 'کمالی',
                'title' => 'سرپرست فروش و بازاریابی صنعتی',
                'phoneNumber' => '09166667788',
                'emailAddress' => 'k.kamali@aryasteel.ir',
                'customerGroups' => ['Reseller'],
            ],
        ];

        $contactEntities = [];
        $contactRepo = $this->entityManager->getRepository('Contact');

        foreach ($contactsData as $key => $data) {
            $fullName = $data['firstName'] . ' ' . $data['lastName'];
            $contact = $contactRepo->where([
                'firstName' => $data['firstName'],
                'lastName' => $data['lastName'],
            ])->findOne();

            if (!$contact) {
                $insertData = $data;
                $insertData['accountId'] = $accountEntities[$key]->getId();
                if ($assignedUserId !== null) {
                    $insertData['assignedUserId'] = $assignedUserId;
                }
                $contact = $this->entityManager->createEntity('Contact', $insertData);
                $this->log($logger, "   [+] مخاطب «{$fullName}» ({$data['title']}) ثبت شد.");
            } elseif ($assignedUserId !== null && !$contact->get('assignedUserId')) {
                $contact->set('assignedUserId', $assignedUserId);
                $this->entityManager->saveEntity($contact);
            }
            $contactEntities[$key] = $contact;
        }

        return $contactEntities;
    }

    /**
     * @return array<string, Entity>
     */
    private function seedProducts(?callable $logger): array
    {
        $this->log($logger, "۴. ایجاد محصولات نمونه بیدار (BidarProduct)...");
        $productsData = [
            'license_pro' => [
                'name' => 'لایسنس سالانه بیدار CRM - نسخه حرفه‌ای',
                'sku' => 'BIDAR-PRO-1Y',
                'unitPrice' => 35000000,
                'category' => 'نرم‌افزار',
                'isActive' => true,
            ],
            'onboarding' => [
                'name' => 'بسته خدمات استقرار، آموزش و اتصال به سامانه مودیان',
                'sku' => 'BIDAR-ONBOARDING',
                'unitPrice' => 20000000,
                'category' => 'خدمات',
                'isActive' => true,
            ],
            'voip_mod' => [
                'name' => 'ماژول اتصال دوطرفه به سانترال VoIP و تلفن ابری',
                'sku' => 'BIDAR-VOIP-MOD',
                'unitPrice' => 15000000,
                'category' => 'ماژول',
                'isActive' => true,
            ],
            'sms_pack' => [
                'name' => 'بسته ۱۰۰,۰۰۰ پیامک خدماتی با خط اختصاصی',
                'sku' => 'BIDAR-SMS-100K',
                'unitPrice' => 12000000,
                'category' => 'ارتباطات',
                'isActive' => true,
            ],
        ];

        $productRepo = $this->entityManager->getRepository('BidarProduct');
        $productEntities = [];

        foreach ($productsData as $key => $pData) {
            $prod = $productRepo->where(['sku' => $pData['sku']])->findOne();
            if (!$prod) {
                $prod = $this->entityManager->createEntity('BidarProduct', $pData);
                $this->log($logger, "   [+] محصول «{$pData['name']}» ({$pData['sku']}) ثبت شد.");
            }
            $productEntities[$key] = $prod;
        }

        return $productEntities;
    }

    /**
     * @param array<string, Entity> $stageMap
     * @param array<string, Entity> $accountEntities
     * @param array<string, Entity> $contactEntities
     * @return array<string, Entity>
     */
    private function seedOpportunities(
        Entity $pipeline,
        array $stageMap,
        array $accountEntities,
        array $contactEntities,
        ?string $assignedUserId,
        ?callable $logger
    ): array {
        $this->log($logger, "۵. ایجاد معاملات کاریز فروش (Opportunities: ۶ فعال + ۱ راکد نمونه + ۱ شکست خورده با دلیل)...");

        $opportunitiesData = [
            [
                'key' => 'kimia_deal',
                'name' => 'سامانه یکپارچه‌سازی ERP با نرم‌افزار فروش کیمیا',
                'account' => 'kimia',
                'amount' => 195000000,
                'stage' => 'Proposal',
                'closeDays' => 18,
                'description' => 'پروژه اتصال سیستم مالی با فرآیندهای بازاریابی و فروش سازمانی کیمیا',
                'probability' => 80,
                'isRotten' => false,
            ],
            [
                'key' => 'zarrin_deal',
                'name' => 'پشتیبانی سالانه و لایسنس سرور اختصاصی زرین‌دشت',
                'account' => 'zarrin',
                'amount' => 81500000,
                'stage' => 'Negotiation',
                'closeDays' => 7,
                'description' => 'تمدید لایسنس ماژول‌های توزیع و مویرگی همراه با SLA پاسخگویی ۲ ساعته',
                'probability' => 85,
                'isRotten' => false,
            ],
            [
                'key' => 'baran_deal',
                'name' => 'داشبورد هوش تجاری و پیگیری خودکار سفارشات باران',
                'account' => 'baran',
                'amount' => 180000000,
                'stage' => 'Qualification',
                'closeDays' => 25,
                'description' => 'طراحی کاریز تحلیل رفتار خریداران آنلاین و پیش‌بینی تقاضای فصلی',
                'probability' => 50,
                'isRotten' => false,
            ],
            [
                'key' => 'sepehr_deal',
                'name' => 'قرارداد خدمات مانیتورینگ صنعتی و تجهیزات پتروشیمی سپهر',
                'account' => 'sepehr',
                'amount' => 650000000,
                'stage' => 'Closed Won',
                'closeDays' => -5,
                'description' => 'قرارداد با موفقیت منعقد گردید و پیش‌پرداخت ۴۰ درصدی واریز شد.',
                'probability' => 100,
                'isRotten' => false,
            ],
            [
                'key' => 'arya_deal',
                'name' => 'نوسازی پلتفرم فروش سازمانی و حواله‌های فولاد آریا',
                'account' => 'arya',
                'amount' => 410000000,
                'stage' => 'Proposal',
                'closeDays' => 12,
                'description' => 'پیش‌فاکتور رسمی ارسال شده و منتظر تاییدیه کمیته خرید کارخانه اهواز هستیم.',
                'probability' => 70,
                'isRotten' => false,
            ],
            [
                'key' => 'baran_active_deal',
                'name' => 'تجهیز زیرساخت ابری و ماژول‌های پیشرفته فروش باران',
                'account' => 'baran',
                'amount' => 145000000,
                'stage' => 'Prospecting',
                'closeDays' => 22,
                'description' => 'مذاکرات اولیه جهت راه‌اندازی ماژول‌های پیشرفته فروش و سیستم تیکتینگ',
                'probability' => 25,
                'isRotten' => false,
            ],
            [
                'key' => 'zist_rotten_deal',
                'name' => 'استقرار زیرساخت پایگاه‌داده دارویی زیست‌یار',
                'account' => 'zist',
                'amount' => 120000000,
                'stage' => 'Prospecting',
                'closeDays' => 30,
                'description' => 'به دلیل گذشت بیش از ۷ روز از آخرین پیگیری، نیازمند اقدام فوری است.',
                'probability' => 20,
                'isRotten' => true,
            ],
            [
                'key' => 'zarrin_lost_deal',
                'name' => 'طراحی سامانه باشگاه مشتریان زرین‌دشت',
                'account' => 'zarrin',
                'amount' => 85000000,
                'stage' => 'Closed Lost',
                'closeDays' => -10,
                'description' => 'مشتری بودجه کافی برای اجرای فاز دوم را نداشت و پروژه متوقف شد.',
                'probability' => 0,
                'isRotten' => false,
                'lossReason' => 'PriceTooHigh',
                'lossReasonNote' => 'مشتری به دلیل محدودیت بودجه و بالا بودن قیمت پیشنهادی از ادامه مذاکره منصرف شد.',
            ],
        ];

        $oppEntities = [];
        $oppRepo = $this->entityManager->getRepository('Opportunity');

        foreach ($opportunitiesData as $d) {
            $opp = $oppRepo->where(['name' => $d['name']])->findOne();
            $account = $accountEntities[$d['account']];
            $contact = $contactEntities[$d['account']];
            $stageEntity = $stageMap[$d['stage']] ?? null;

            $closeDate = date('Y-m-d', strtotime(($d['closeDays'] >= 0 ? "+{$d['closeDays']}" : "{$d['closeDays']}") . ' days'));
            $lastActivityAt = $d['isRotten']
                ? date('Y-m-d H:i:s', strtotime('-10 days'))
                : date('Y-m-d H:i:s', strtotime('-1 hour'));

            if (!$opp) {
                $oppData = [
                    'name' => $d['name'],
                    'amount' => $d['amount'],
                    'stage' => $d['stage'],
                    'pipelineId' => $pipeline->getId(),
                    'pipelineStageId' => $stageEntity ? $stageEntity->getId() : null,
                    'accountId' => $account->getId(),
                    'contactId' => $contact->getId(),
                    'closeDate' => $closeDate,
                    'probability' => $d['probability'],
                    'description' => $d['description'],
                    'lastActivityAt' => $lastActivityAt,
                ];
                if (!empty($d['lossReason'])) {
                    $oppData['lossReason'] = $d['lossReason'];
                }
                if (!empty($d['lossReasonNote'])) {
                    $oppData['lossReasonNote'] = $d['lossReasonNote'];
                }
                if ($assignedUserId !== null) {
                    $oppData['assignedUserId'] = $assignedUserId;
                }
                $opp = $this->entityManager->createEntity('Opportunity', $oppData);
                $this->log($logger, "   [+] معامله «{$d['name']}» ایجاد شد.");
            } elseif ($assignedUserId !== null && !$opp->get('assignedUserId')) {
                $opp->set('assignedUserId', $assignedUserId);
                $this->entityManager->saveEntity($opp);
            }
            $oppEntities[$d['key']] = $opp;
        }

        return $oppEntities;
    }

    /**
     * @param array<string, Entity> $oppEntities
     * @param array<string, Entity> $productEntities
     * @return list<Entity>
     */
    private function seedDealItems(array $oppEntities, array $productEntities, ?callable $logger): array
    {
        $this->log($logger, "۶. ثبت اقلام نمونه روی معاملات (BidarDealItem)...");

        $dealItemsData = [
            [
                'dealKey' => 'kimia_deal',
                'productKey' => 'license_pro',
                'quantity' => 5.0,
                'unitPrice' => 35000000.0,
                'discountPercent' => 0.0,
                'lineTotal' => 175000000.0,
            ],
            [
                'dealKey' => 'kimia_deal',
                'productKey' => 'onboarding',
                'quantity' => 1.0,
                'unitPrice' => 20000000.0,
                'discountPercent' => 0.0,
                'lineTotal' => 20000000.0,
            ],
            [
                'dealKey' => 'zarrin_deal',
                'productKey' => 'license_pro',
                'quantity' => 2.0,
                'unitPrice' => 35000000.0,
                'discountPercent' => 5.0,
                'lineTotal' => 66500000.0,
            ],
            [
                'dealKey' => 'zarrin_deal',
                'productKey' => 'voip_mod',
                'quantity' => 1.0,
                'unitPrice' => 15000000.0,
                'discountPercent' => 0.0,
                'lineTotal' => 15000000.0,
            ],
        ];

        $itemRepo = $this->entityManager->getRepository('BidarDealItem');
        $dealItemEntities = [];

        foreach ($dealItemsData as $iData) {
            $opp = $oppEntities[$iData['dealKey']] ?? null;
            $prod = $productEntities[$iData['productKey']] ?? null;
            if (!$opp || !$prod) {
                continue;
            }

            $existing = $itemRepo->where([
                'opportunityId' => $opp->getId(),
                'name' => $prod->get('name'),
            ])->findOne();

            if (!$existing) {
                $item = $this->entityManager->createEntity('BidarDealItem', [
                    'name' => $prod->get('name'),
                    'opportunityId' => $opp->getId(),
                    'productId' => $prod->getId(),
                    'quantity' => $iData['quantity'],
                    'unitPrice' => $iData['unitPrice'],
                    'discountPercent' => $iData['discountPercent'],
                    'lineTotal' => $iData['lineTotal'],
                ]);
                $this->log($logger, "   [+] قلم کالای «{$prod->get('name')}» به معامله «{$opp->get('name')}» اضافه شد.");
                $existing = $item;
            }
            $dealItemEntities[] = $existing;
        }

        return $dealItemEntities;
    }

    /**
     * @return list<Entity>
     */
    private function seedSalesGoal(?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۷. ثبت هدف فروش ماهانه شمسی (BidarGoal)...");
        $goalRepo = $this->entityManager->getRepository('BidarGoal');
        $goalName = 'تارگت فروش ماهانه تیم فروش سازمانی';
        $goal = $goalRepo->where(['name' => $goalName])->findOne();

        if (!$goal) {
            $goalStart = date('Y-m-01');
            $goalEnd = date('Y-m-t');

            if (class_exists(\Espo\Modules\BidarIran\Support\JalaliHelper::class)) {
                try {
                    $range = \Espo\Modules\BidarIran\Support\JalaliHelper::getCurrentJalaliMonthRange();
                    if (!empty($range['start']) && !empty($range['end'])) {
                        $goalStart = substr($range['start'], 0, 10);
                        $goalEnd = substr($range['end'], 0, 10);
                    }
                } catch (\Throwable) {
                    // Fallback to Gregorian month start/end
                }
            }

            $goalData = [
                'name' => $goalName,
                'metricType' => 'wonAmount',
                'scopeType' => 'all',
                'period' => 'monthly',
                'dateStart' => $goalStart,
                'dateEnd' => $goalEnd,
                'targetValue' => 1500000000.0,
            ];
            if ($assignedUserId !== null) {
                $goalData['assignedUserId'] = $assignedUserId;
            }
            $goal = $this->entityManager->createEntity('BidarGoal', $goalData);
            $this->log($logger, "   [+] هدف فروش ماهانه «{$goalName}» ثبت شد.");
        } elseif ($assignedUserId !== null && !$goal->get('assignedUserId')) {
            $goal->set('assignedUserId', $assignedUserId);
            $this->entityManager->saveEntity($goal);
        }

        return [$goal];
    }

    /**
     * @return list<Entity>
     */
    private function seedSmsTemplates(?callable $logger): array
    {
        $this->log($logger, "۸. ایجاد قالب‌های آماده پیامک (BidarSmsTemplate)...");
        $templatesData = [
            [
                'name' => 'خوش‌آمدگویی و تایید جلسه دمو',
                'body' => 'مشتری گرامی {contact.name}، جلسه دمو آنلاین سامانه فروش شما برای روز {meeting.date} هماهنگ شد. بیدار CRM',
                'isActive' => true,
            ],
            [
                'name' => 'ارسال پیش‌فاکتور و تاییدیه مالی',
                'body' => 'جناب {contact.lastName}، پیش‌فاکتور معامله {deal.name} با مبلغ {deal.amount} تومان صادر شد. با احترام، بیدار CRM',
                'isActive' => true,
            ],
        ];

        $smsRepo = $this->entityManager->getRepository('BidarSmsTemplate');
        $smsEntities = [];

        foreach ($templatesData as $tpl) {
            $existing = $smsRepo->where(['name' => $tpl['name']])->findOne();
            if (!$existing) {
                $existing = $this->entityManager->createEntity('BidarSmsTemplate', $tpl);
                $this->log($logger, "   [+] قالب پیامک «{$tpl['name']}» ایجاد شد.");
            }
            $smsEntities[] = $existing;
        }

        return $smsEntities;
    }

    /**
     * @param array<string, Entity> $oppEntities
     * @return list<Entity>
     */
    private function seedTasks(array $oppEntities, ?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۹. ایجاد وظایف کاری (Tasks)...");
        $tasksData = [
            [
                'name' => 'ارسال پیش‌فاکتور نهایی و فرم تاییدیه بانکی',
                'dealKey' => 'kimia_deal',
                'status' => 'Not Started',
                'dateOffset' => '+2 hours',
                'priority' => 'High',
            ],
            [
                'name' => 'پیگیری وضعیت صدور حواله پرداخت و ثبت قرارداد',
                'dealKey' => 'zarrin_deal',
                'status' => 'Started',
                'dateOffset' => '+1 day +3 hours',
                'priority' => 'Normal',
            ],
            [
                'name' => 'تماس اضطراری و تعیین وضعیت مذاکره (معوق)',
                'dealKey' => 'zist_rotten_deal',
                'status' => 'Not Started',
                'dateOffset' => '-2 days',
                'priority' => 'Urgent',
            ],
            [
                'name' => 'هماهنگی جلسه بازبینی پروپوزال با واحد مهندسی',
                'dealKey' => 'arya_deal',
                'status' => 'Not Started',
                'dateOffset' => '+4 hours',
                'priority' => 'Normal',
            ],
            [
                'name' => 'ارسال کاتالوگ تکمیلی و معرفی نیازمندی‌ها',
                'dealKey' => 'baran_deal',
                'status' => 'Started',
                'dateOffset' => '+1 day',
                'priority' => 'Low',
            ],
        ];

        $taskRepo = $this->entityManager->getRepository('Task');
        $taskEntities = [];

        foreach ($tasksData as $t) {
            $opp = $oppEntities[$t['dealKey']] ?? null;
            $existing = null;
            if ($opp) {
                $existing = $taskRepo->where(['name' => $t['name'], 'parentId' => $opp->getId()])->findOne();
            } else {
                $existing = $taskRepo->where(['name' => $t['name']])->findOne();
            }

            if (!$existing) {
                $taskData = [
                    'name' => $t['name'],
                    'status' => $t['status'],
                    'priority' => $t['priority'],
                    'dateEnd' => date('Y-m-d H:i:s', strtotime($t['dateOffset'])),
                    'parentType' => $opp ? 'Opportunity' : null,
                    'parentId' => $opp ? $opp->getId() : null,
                    'accountId' => $opp ? $opp->get('accountId') : null,
                    'contactId' => $opp ? $opp->get('contactId') : null,
                ];
                if ($assignedUserId !== null) {
                    $taskData['assignedUserId'] = $assignedUserId;
                }
                $existing = $this->entityManager->createEntity('Task', $taskData);
                $this->log($logger, "   [+] وظیفه «{$t['name']}» ایجاد شد.");
            } elseif ($assignedUserId !== null && !$existing->get('assignedUserId')) {
                $existing->set('assignedUserId', $assignedUserId);
                $this->entityManager->saveEntity($existing);
            }
            $taskEntities[] = $existing;
        }

        return $taskEntities;
    }

    /**
     * @param array<string, Entity> $oppEntities
     * @return list<Entity>
     */
    private function seedCalls(array $oppEntities, ?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۱۰. ثبت تماس‌های تلفنی (Calls)...");
        $callsData = [
            [
                'name' => 'تماس تلفنی اولیه جهت استخراج الزامات فنی',
                'dealKey' => 'kimia_deal',
                'status' => 'Held',
                'direction' => 'Outbound',
                'dateOffset' => '-1 day',
            ],
            [
                'name' => 'مکالمه با مدیریت بازرگانی در خصوص شرایط تخفیف',
                'dealKey' => 'zarrin_deal',
                'status' => 'Held',
                'direction' => 'Inbound',
                'dateOffset' => '-4 hours',
            ],
        ];

        $callRepo = $this->entityManager->getRepository('Call');
        $callEntities = [];

        foreach ($callsData as $c) {
            $opp = $oppEntities[$c['dealKey']] ?? null;
            $existing = null;
            if ($opp) {
                $existing = $callRepo->where(['name' => $c['name'], 'parentId' => $opp->getId()])->findOne();
            } else {
                $existing = $callRepo->where(['name' => $c['name']])->findOne();
            }

            if (!$existing) {
                $callData = [
                    'name' => $c['name'],
                    'status' => $c['status'],
                    'direction' => $c['direction'],
                    'dateStart' => date('Y-m-d H:i:s', strtotime($c['dateOffset'])),
                    'parentType' => $opp ? 'Opportunity' : null,
                    'parentId' => $opp ? $opp->getId() : null,
                    'accountId' => $opp ? $opp->get('accountId') : null,
                    'contactId' => $opp ? $opp->get('contactId') : null,
                ];
                if ($assignedUserId !== null) {
                    $callData['assignedUserId'] = $assignedUserId;
                }
                $existing = $this->entityManager->createEntity('Call', $callData);
                $this->log($logger, "   [+] تماس «{$c['name']}» ثبت شد.");
            } elseif ($assignedUserId !== null && !$existing->get('assignedUserId')) {
                $existing->set('assignedUserId', $assignedUserId);
                $this->entityManager->saveEntity($existing);
            }
            $callEntities[] = $existing;
        }

        return $callEntities;
    }

    /**
     * @param array<string, Entity> $oppEntities
     * @return list<Entity>
     */
    private function seedMeetings(array $oppEntities, ?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۱۱. ایجاد جلسات و رویدادهای تقویم (Meetings & Calendar)...");
        $meetingsData = [
            [
                'name' => 'جلسه دمو آنلاین معماری کاریز فروش بیدار',
                'status' => 'Planned',
                'dateStart' => date('Y-m-d H:i:s', strtotime('today 10:00:00')),
                'dateEnd' => date('Y-m-d H:i:s', strtotime('today 11:30:00')),
                'dealKey' => 'kimia_deal',
                'description' => 'ارائه دمو آنلاین و قابلیت‌های اتوماسیون پیگیری معاملات برای تیم فروش کیمیا',
            ],
            [
                'name' => 'جلسه بررسی مفاد قرارداد و SLA پشتیبانی زرین‌دشت',
                'status' => 'Planned',
                'dateStart' => date('Y-m-d H:i:s', strtotime('+1 day 14:00:00')),
                'dateEnd' => date('Y-m-d H:i:s', strtotime('+1 day 15:30:00')),
                'dealKey' => 'zarrin_deal',
                'description' => 'مذاکره نهایی با مدیر بازرگانی زرین‌دشت جهت نهایی‌سازی شرایط پرداخت',
            ],
            [
                'name' => 'جلسه استخراج نیازمندی‌های وب‌سرویس باران',
                'status' => 'Planned',
                'dateStart' => date('Y-m-d H:i:s', strtotime('+2 days 11:00:00')),
                'dateEnd' => date('Y-m-d H:i:s', strtotime('+2 days 12:30:00')),
                'dealKey' => 'baran_deal',
                'description' => 'جلسه فنی مشترک با معاونت عملیات شرکت باران جهت اتصال هوش تجاری',
            ],
            [
                'name' => 'جلسه حضوری تحویل پروژه و مستندات پتروشیمی سپهر',
                'status' => 'Held',
                'dateStart' => date('Y-m-d H:i:s', strtotime('-3 days 09:00:00')),
                'dateEnd' => date('Y-m-d H:i:s', strtotime('-3 days 11:00:00')),
                'dealKey' => 'sepehr_deal',
                'description' => 'جلسه در محل مجتمع عسلویه با حضور مهندس قادری برگزار و صورتجلسه امضا شد.',
            ],
            [
                'name' => 'جلسه دوره‌ای بازبینی تارگت و استراتژی فروش سه‌ماهه',
                'status' => 'Planned',
                'dateStart' => date('Y-m-d H:i:s', strtotime('+4 days 09:30:00')),
                'dateEnd' => date('Y-m-d H:i:s', strtotime('+4 days 11:00:00')),
                'dealKey' => null,
                'description' => 'جلسه راهبردی داخلی تیم بازاریابی و فروش سازمانی بیدار',
            ],
        ];

        $meetingRepo = $this->entityManager->getRepository('Meeting');
        $meetingEntities = [];

        foreach ($meetingsData as $m) {
            $opp = $m['dealKey'] ? ($oppEntities[$m['dealKey']] ?? null) : null;
            $existing = $meetingRepo->where(['name' => $m['name']])->findOne();

            if (!$existing) {
                $meetingData = [
                    'name' => $m['name'],
                    'status' => $m['status'],
                    'dateStart' => $m['dateStart'],
                    'dateEnd' => $m['dateEnd'],
                    'description' => $m['description'],
                    'parentType' => $opp ? 'Opportunity' : null,
                    'parentId' => $opp ? $opp->getId() : null,
                    'accountId' => $opp ? $opp->get('accountId') : null,
                ];
                if ($assignedUserId !== null) {
                    $meetingData['assignedUserId'] = $assignedUserId;
                }
                $existing = $this->entityManager->createEntity('Meeting', $meetingData);
                $this->log($logger, "   [+] جلسه تقویم «{$m['name']}» ایجاد شد.");
            } elseif ($assignedUserId !== null && !$existing->get('assignedUserId')) {
                $existing->set('assignedUserId', $assignedUserId);
                $this->entityManager->saveEntity($existing);
            }
            $meetingEntities[] = $existing;
        }

        return $meetingEntities;
    }

    /**
     * @return list<Entity>
     */
    private function seedLeads(?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۱۲. ایجاد سرنخ‌های فروش (Leads)...");
        $leadsData = [
            [
                'firstName' => 'سعید',
                'lastName' => 'مقدم',
                'accountName' => 'شرکت نوآوران ابری پارس',
                'title' => 'مدیر زیرساخت و دواپس',
                'status' => 'New',
                'source' => 'Web Site',
                'opportunityAmount' => 75000000,
                'phoneNumber' => '09129998877',
                'emailAddress' => 's.moghadam@parsiandc.ir',
                'website' => 'https://parsiandc.ir',
                'addressCity' => 'تهران',
                'description' => 'درخواست استعلام قیمت سرور اختصاصی و سیستم تیکتینگ یکپارچه از لندینگ سایت.',
            ],
            [
                'firstName' => 'مهناز',
                'lastName' => 'فرهمند',
                'accountName' => 'گروه هتلداری و گردشگری سپید',
                'title' => 'مدیر ارشد فروش و رزرواسیون',
                'status' => 'Assigned',
                'source' => 'Campaign',
                'opportunityAmount' => 110000000,
                'phoneNumber' => '09174443322',
                'emailAddress' => 'm.farahmand@sepidhotels.com',
                'website' => 'https://sepidhotels.com',
                'addressCity' => 'کیش',
                'description' => 'ارتباط حاصل از کمپین بازاریابی دیجیتال زمستانه؛ نیازمند اتصال به پیامک و VoIP.',
            ],
            [
                'firstName' => 'نیما',
                'lastName' => 'صبوری',
                'accountName' => 'صنایع تجهیزات پزشکی رازی',
                'title' => 'سرپرست فروش تجهیزات بیمارستانی',
                'status' => 'In Process',
                'source' => 'Existing Customer',
                'opportunityAmount' => 185000000,
                'phoneNumber' => '09142221100',
                'emailAddress' => 'n.saboori@razimed.ir',
                'website' => 'https://razimed.ir',
                'addressCity' => 'تبریز',
                'description' => 'معرفی شده توسط مدیریت پتروشیمی سپهر؛ جلسه دمو اولیه برای هفته آینده تنظیم شد.',
            ],
            [
                'firstName' => 'پژمان',
                'lastName' => 'طاهری',
                'accountName' => 'شرکت حمل‌ونقل بین‌المللی شتاب',
                'title' => 'معاونت بازرگانی و ترخیص کالا',
                'status' => 'In Process',
                'source' => 'Call',
                'opportunityAmount' => 220000000,
                'phoneNumber' => '09176665544',
                'emailAddress' => 'taheri@shetab-cargo.ir',
                'website' => 'https://shetab-cargo.ir',
                'addressCity' => 'بندرعباس',
                'description' => 'نیاز به ردیابی حواله‌ها و یکپارچه‌سازی فرآیندهای انبارداری با CRM.',
            ],
            [
                'firstName' => 'هدیه',
                'lastName' => 'کریمی',
                'accountName' => 'استارتاپ مالی زرین‌پِی',
                'title' => 'بنیان‌گذار و مدیر محصول',
                'status' => 'New',
                'source' => 'Web Site',
                'opportunityAmount' => 90000000,
                'phoneNumber' => '09123334411',
                'emailAddress' => 'h.karimi@zarrinpay.io',
                'website' => 'https://zarrinpay.io',
                'addressCity' => 'تهران',
                'description' => 'علاقه‌مند به وب‌هوک‌های دوطرفه و ماژول خودکار صادرکننده پیش‌فاکتور بیدار.',
            ],
        ];

        $leadRepo = $this->entityManager->getRepository('Lead');
        $leadEntities = [];

        foreach ($leadsData as $ld) {
            $fullName = $ld['firstName'] . ' ' . $ld['lastName'];
            $existing = $leadRepo->where([
                'firstName' => $ld['firstName'],
                'lastName' => $ld['lastName'],
            ])->findOne();

            if (!$existing) {
                $insertData = $ld;
                if ($assignedUserId !== null) {
                    $insertData['assignedUserId'] = $assignedUserId;
                }
                $existing = $this->entityManager->createEntity('Lead', $insertData);
                $this->log($logger, "   [+] سرنخ «{$fullName}» ({$ld['accountName']}) ایجاد شد.");
            } elseif ($assignedUserId !== null && !$existing->get('assignedUserId')) {
                $existing->set('assignedUserId', $assignedUserId);
                $this->entityManager->saveEntity($existing);
            }
            $leadEntities[] = $existing;
        }

        return $leadEntities;
    }

    /**
     * @param array<string, Entity> $oppEntities
     * @return list<Entity>
     */
    private function seedNotes(array $oppEntities, ?string $assignedUserId, ?callable $logger): array
    {
        $this->log($logger, "۱۳. ثبت یادداشت‌های استریم ۳۶۰ درجه مذاکرات...");
        $notesData = [
            ['dealKey' => 'kimia_deal', 'post' => 'جلسه ارائه دمو با حضور مهندس سلیمانی برگزار شد. بخش ماژول کاریز فروش بیدار مورد استقبال تیم فنی قرار گرفت.'],
            ['dealKey' => 'zarrin_deal', 'post' => 'درخواست تخفیف ۵ درصدی توسط مشتری ثبت شد؛ مشروط به تسویه نقدی پیش‌فاکتور موافقت گردید.'],
            ['dealKey' => 'sepehr_deal', 'post' => 'قرارداد نهایی امضا شد. نسخه چاپی با هولوگرام رسمی تحویل واحد اداری گردید.'],
            ['dealKey' => 'zist_rotten_deal', 'post' => 'تلاش برای تماس در تاریخ ۱۰ روز قبل بی‌نتیجه ماند. مشتری در سفر کاری بود.'],
        ];

        $noteRepo = $this->entityManager->getRepository('Note');
        $noteEntities = [];

        foreach ($notesData as $n) {
            $opp = $oppEntities[$n['dealKey']] ?? null;
            if (!$opp) {
                continue;
            }

            $existing = $noteRepo->where([
                'parentId' => $opp->getId(),
                'post' => $n['post'],
            ])->findOne();

            if (!$existing) {
                $noteData = [
                    'post' => $n['post'],
                    'type' => 'Post',
                    'parentType' => 'Opportunity',
                    'parentId' => $opp->getId(),
                ];
                if ($assignedUserId !== null) {
                    $noteData['createdById'] = $assignedUserId;
                }
                $existing = $this->entityManager->createEntity('Note', $noteData);
                $this->log($logger, "   [+] یادداشت استریم برای معامله «{$opp->get('name')}» درج شد.");
            }
            $noteEntities[] = $existing;
        }

        return $noteEntities;
    }
}
