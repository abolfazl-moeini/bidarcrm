<?php
/**
 * BidarCRM - High-Quality Realistic Persian B2B Sample Data Seeder
 *
 * اسکریپت جامع تولید داده‌های نمونه و تجاری برای نرم‌افزار بیدار
 * پوشش کامل تمامی بخش‌ها:
 *   - کاریز و مراحل فروش (Pipeline & Pipeline Stages)
 *   - شرکت‌ها (Accounts)
 *   - مخاطبان (Contacts)
 *   - معاملات (Opportunities)
 *   - وظایف و تسک‌ها (Tasks)
 *   - تماس‌ها (Calls)
 *   - جلسات و تقویم (Meetings & Calendar)
 *   - سرنخ‌های فروش (Leads)
 *   - ایمیل‌ها و مکاتبات سازمانی (Emails)
 *   - پایگاه دانش و دسته‌بندی‌ها (KnowledgeBase Articles & Categories)
 *   - استریم ۳۶۰ درجه مذاکرات (Stream Notes)
 *
 * نحوه اجرا:
 *   php seed-sample-data.php
 * یا در محیط داکر:
 *   docker exec bidarcrm-app php seed-sample-data.php
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    header('Content-Type: text/plain; charset=utf-8');
}

echo "============================================================\n";
echo "   سامانه بیدار (BidarCRM) - تولید داده‌های جامع و واقعی نمونه   \n";
echo "============================================================\n\n";

if (!file_exists(__DIR__ . '/bootstrap.php')) {
    die("خطا: فایل bootstrap.php یافت نشد. اسکریپت را در ریشه نصب اجرا کنید.\n");
}

require_once __DIR__ . '/bootstrap.php';

use Espo\Core\Application;

try {
    $app = new Application();
    $container = $app->getContainer();
    $container->get('applicationUser')->setupSystemUser();
    $em = $container->get('entityManager');

    echo " اتصال به پایگاه داده و هسته سیستم با موفقیت برقرار شد.\n\n";

    // =========================================================================
    // ۱. کاریز اصلی فروش و مراحل کاریز
    // =========================================================================
    echo "۱. راه‌اندازی کاریز اصلی فروش و مراحل کاریز...\n";
    $pipelineRepo = $em->getRepository('Pipeline');
    $pipeline = $pipelineRepo->where(['name' => 'کاریز اصلی فروش'])->findOne();

    if (!$pipeline) {
        $pipeline = $em->createEntity('Pipeline', [
            'name'              => 'کاریز اصلی فروش',
            'entityType'        => 'Opportunity',
            'field'             => 'stage',
            'isAvailableForAll' => true,
        ]);
        echo "   [+] کاریز «کاریز اصلی فروش» ایجاد شد.\n";
    }

    $stagesConfig = [
        ['name' => 'تماس اولیه', 'mappedStatus' => 'Prospecting', 'order' => 0, 'rottenDays' => 3],
        ['name' => 'پیگیری و مذاکره', 'mappedStatus' => 'Qualification', 'order' => 1, 'rottenDays' => 5],
        ['name' => 'ارسال پیش‌فاکتور', 'mappedStatus' => 'Proposal', 'order' => 2, 'rottenDays' => 4],
        ['name' => 'مذاکره نهایی', 'mappedStatus' => 'Negotiation', 'order' => 3, 'rottenDays' => 5],
        ['name' => 'موفق (برنده)', 'mappedStatus' => 'Closed Won', 'order' => 4, 'rottenDays' => null],
        ['name' => 'ناموفق (از دست رفته)', 'mappedStatus' => 'Closed Lost', 'order' => 5, 'rottenDays' => null],
    ];

    $stageMap = [];
    $stageRepo = $em->getRepository('PipelineStage');

    foreach ($stagesConfig as $cfg) {
        $existingStage = $stageRepo->where([
            'pipelineId' => $pipeline->getId(),
            'name'       => $cfg['name'],
        ])->findOne();

        if (!$existingStage) {
            $existingStage = $em->createEntity('PipelineStage', [
                'name'         => $cfg['name'],
                'pipelineId'   => $pipeline->getId(),
                'mappedStatus' => $cfg['mappedStatus'],
                'order'        => $cfg['order'],
                'rottenDays'   => $cfg['rottenDays'],
            ]);
            echo "   [+] مرحله «{$cfg['name']}» ایجاد شد.\n";
        }
        $stageMap[$cfg['mappedStatus']] = $existingStage;
    }

    // =========================================================================
    // ۲. شرکت‌ها و سازمان‌ها (Accounts)
    // =========================================================================
    echo "\n۲. ایجاد شرکت‌ها و مشتریان سازمانی (Accounts)...\n";
    $accountsData = [
        'kimia' => [
            'name'               => 'فناوران داده‌پرداز کیمیا',
            'industry'           => 'Technology',
            'type'               => 'Customer',
            'phoneNumber'        => '02188776655',
            'emailAddress'       => 'info@kimiadata.ir',
            'website'            => 'https://kimiadata.ir',
            'billingAddressCity' => 'تهران',
        ],
        'zarrin' => [
            'name'               => 'صنایع غذایی زرین‌دشت',
            'industry'           => 'Food & Beverage',
            'type'               => 'Customer',
            'phoneNumber'        => '03132211440',
            'emailAddress'       => 'sales@zarrindasht.com',
            'website'            => 'https://zarrindasht.com',
            'billingAddressCity' => 'اصفهان',
        ],
        'sepehr' => [
            'name'               => 'پتروشیمی سپهر خلیج فارس',
            'industry'           => 'Chemicals',
            'type'               => 'Customer',
            'phoneNumber'        => '07737229988',
            'emailAddress'       => 'crm@sepehr-pg.ir',
            'website'            => 'https://sepehr-pg.ir',
            'billingAddressCity' => 'عسلویه',
        ],
        'baran' => [
            'name'               => 'توسعه تجارت الکترونیک باران',
            'industry'           => 'Retail',
            'type'               => 'Customer',
            'phoneNumber'        => '02144556677',
            'emailAddress'       => 'contact@baran-commerce.com',
            'website'            => 'https://baran-commerce.com',
            'billingAddressCity' => 'تهران',
        ],
        'zist' => [
            'name'               => 'گروه دارویی زیست‌یار نوین',
            'industry'           => 'Pharmaceuticals',
            'type'               => 'Customer',
            'phoneNumber'        => '05138401122',
            'emailAddress'       => 'support@zistyarnovin.ir',
            'website'            => 'https://zistyarnovin.ir',
            'billingAddressCity' => 'مشهد',
        ],
        'arya' => [
            'name'               => 'فولاد و نورد آریا گستر',
            'industry'           => 'Manufacturing',
            'type'               => 'Customer',
            'phoneNumber'        => '06133344550',
            'emailAddress'       => 'office@aryasteel.ir',
            'website'            => 'https://aryasteel.ir',
            'billingAddressCity' => 'اهواز',
        ],
    ];

    $accountEntities = [];
    $accountRepo = $em->getRepository('Account');

    foreach ($accountsData as $key => $data) {
        $acc = $accountRepo->where(['name' => $data['name']])->findOne();
        if (!$acc) {
            $acc = $em->createEntity('Account', $data);
            echo "   [+] شرکت «{$data['name']}» ایجاد شد.\n";
        }
        $accountEntities[$key] = $acc;
    }

    // =========================================================================
    // ۳. مخاطبان کلیدی (Contacts)
    // =========================================================================
    echo "\n۳. ایجاد مخاطبان و تصمیم‌گیرندگان کلیدی (Contacts)...\n";
    $contactsData = [
        'kimia' => [
            'firstName'    => 'علیرضا',
            'lastName'     => 'سلیمانی',
            'title'        => 'مدیر ارشد فناوری (CTO)',
            'phoneNumber'  => '09121112233',
            'emailAddress' => 'a.soleimani@kimiadata.ir',
        ],
        'zarrin' => [
            'firstName'    => 'مریم',
            'lastName'     => 'انصاری',
            'title'        => 'مدیر تامین و بازرگانی',
            'phoneNumber'  => '09132223344',
            'emailAddress' => 'ansari@zarrindasht.com',
        ],
        'sepehr' => [
            'firstName'    => 'احسان',
            'lastName'     => 'قادری',
            'title'        => 'رئیس پشتیبانی سیستم‌ها',
            'phoneNumber'  => '09173334455',
            'emailAddress' => 'e.ghaderi@sepehr-pg.ir',
        ],
        'baran' => [
            'firstName'    => 'بهزاد',
            'lastName'     => 'مرادی',
            'title'        => 'معاون عملیات و لجستیک',
            'phoneNumber'  => '09124445566',
            'emailAddress' => 'b.moradi@baran-commerce.com',
        ],
        'zist' => [
            'firstName'    => 'سپیده',
            'lastName'     => 'رادفر',
            'title'        => 'مدیر تضمین کیفیت و استاندارد',
            'phoneNumber'  => '09155556677',
            'emailAddress' => 's.radfar@zistyarnovin.ir',
        ],
        'arya' => [
            'firstName'    => 'کوروش',
            'lastName'     => 'کمالی',
            'title'        => 'سرپرست فروش و بازاریابی صنعتی',
            'phoneNumber'  => '09166667788',
            'emailAddress' => 'k.kamali@aryasteel.ir',
        ],
    ];

    $contactEntities = [];
    $contactRepo = $em->getRepository('Contact');

    foreach ($contactsData as $key => $data) {
        $fullName = $data['firstName'] . ' ' . $data['lastName'];
        $contact = $contactRepo->where([
            'firstName' => $data['firstName'],
            'lastName'  => $data['lastName'],
        ])->findOne();

        if (!$contact) {
            $data['accountId'] = $accountEntities[$key]->getId();
            $contact = $em->createEntity('Contact', $data);
            echo "   [+] مخاطب «{$fullName}» ({$data['title']}) ثبت شد.\n";
        }
        $contactEntities[$key] = $contact;
    }

    // =========================================================================
    // ۴. فرصت‌ها و معاملات کاریز (Opportunities)
    // =========================================================================
    echo "\n۴. ایجاد فرصت‌های فروش و معاملات کاریز (Opportunities)...\n";
    $opportunitiesData = [
        [
            'key'         => 'kimia_deal',
            'name'        => 'سامانه یکپارچه‌سازی ERP با نرم‌افزار فروش کیمیا',
            'account'     => 'kimia',
            'amount'      => 240000000,
            'stage'       => 'Proposal',
            'closeDays'   => 18,
            'description' => 'پروژه اتصال سیستم مالی با فرآیندهای بازاریابی و فروش سازمانی کیمیا',
            'probability' => 80,
            'isRotten'    => false,
        ],
        [
            'key'         => 'zarrin_deal',
            'name'        => 'پشتیبانی سالانه و لایسنس سرور اختصاصی زرین‌دشت',
            'account'     => 'zarrin',
            'amount'      => 95000000,
            'stage'       => 'Negotiation',
            'closeDays'   => 7,
            'description' => 'تمدید لایسنس ماژول‌های توزیع و مویرگی همراه با SLA پاسخگویی ۲ ساعته',
            'probability' => 85,
            'isRotten'    => false,
        ],
        [
            'key'         => 'baran_deal',
            'name'        => 'داشبورد هوش تجاری و پیگیری خودکار سفارشات باران',
            'account'     => 'baran',
            'amount'      => 180000000,
            'stage'       => 'Qualification',
            'closeDays'   => 25,
            'description' => 'طراحی پایپ‌لاین تحلیل رفتار خریداران آنلاین و پیش‌بینی تقاضای فصلی',
            'probability' => 50,
            'isRotten'    => false,
        ],
        [
            'key'         => 'sepehr_deal',
            'name'        => 'قرارداد خدمات مانیتورینگ صنعتی و تجهیزات پتروشیمی سپهر',
            'account'     => 'sepehr',
            'amount'      => 650000000,
            'stage'       => 'Closed Won',
            'closeDays'   => -5,
            'description' => 'قرارداد با موفقیت منعقد گردید و پیش‌پرداخت ۴۰ درصدی واریز شد.',
            'probability' => 100,
            'isRotten'    => false,
        ],
        [
            'key'         => 'zist_deal',
            'name'        => 'استقرار زیرساخت پایگاه‌داده دارویی زیست‌یار',
            'account'     => 'zist',
            'amount'      => 120000000,
            'stage'       => 'Prospecting',
            'closeDays'   => 30,
            'description' => 'به دلیل گذشت بیش از ۷ روز از آخرین پیگیری، نیازمند اقدام فوری است.',
            'probability' => 20,
            'isRotten'    => true,
        ],
        [
            'key'         => 'arya_deal',
            'name'        => 'نوسازی پلتفرم فروش سازمانی و حواله‌های فولاد آریا',
            'account'     => 'arya',
            'amount'      => 410000000,
            'stage'       => 'Proposal',
            'closeDays'   => 12,
            'description' => 'پیش‌فاکتور رسمی ارسال شده و منتظر تاییدیه کمیته خرید کارخانه اهواز هستیم.',
            'probability' => 70,
            'isRotten'    => false,
        ],
    ];

    $oppEntities = [];
    $oppRepo = $em->getRepository('Opportunity');

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
            $opp = $em->createEntity('Opportunity', [
                'name'            => $d['name'],
                'amount'          => $d['amount'],
                'stage'           => $d['stage'],
                'pipelineId'      => $pipeline->getId(),
                'pipelineStageId' => $stageEntity ? $stageEntity->getId() : null,
                'accountId'       => $account->getId(),
                'contactId'       => $contact->getId(),
                'closeDate'       => $closeDate,
                'probability'     => $d['probability'],
                'description'     => $d['description'],
                'lastActivityAt'  => $lastActivityAt,
            ]);
            $amountFormatted = number_format($d['amount'] / 10);
            echo "   [+] معامله «{$d['name']}» ({$amountFormatted} تومان) ایجاد شد.\n";
        }
        $oppEntities[$d['key']] = $opp;
    }

    // =========================================================================
    // ۵. وظایف (Tasks) و تماس‌ها (Calls)
    // =========================================================================
    echo "\n۵. ایجاد فعالیت‌ها و وظایف کاری (Tasks)...\n";
    $taskRepo = $em->getRepository('Task');
    $tasksSeed = [
        [
            'name'       => 'ارسال پیش‌فاکتور نهایی و فرم تاییدیه بانکی',
            'dealKey'    => 'kimia_deal',
            'status'     => 'Not Started',
            'dateOffset' => '+2 hours', // امروز
            'priority'   => 'High',
        ],
        [
            'name'       => 'پیگیری وضعیت صدور حواله پرداخت و ثبت قرارداد',
            'dealKey'    => 'zarrin_deal',
            'status'     => 'In Progress',
            'dateOffset' => '+1 day +3 hours', // فردا
            'priority'   => 'Normal',
        ],
        [
            'name'       => 'تماس اضطراری و تعیین وضعیت مذاکره (معوق)',
            'dealKey'    => 'zist_deal',
            'status'     => 'Not Started',
            'dateOffset' => '-2 days', // معوقه
            'priority'   => 'Urgent',
        ],
        [
            'name'       => 'هماهنگی جلسه بازبینی پروپوزال با واحد مهندسی',
            'dealKey'    => 'arya_deal',
            'status'     => 'Not Started',
            'dateOffset' => '+4 hours', // امروز
            'priority'   => 'Normal',
        ],
        [
            'name'       => 'ارسال کاتالوگ تکمیلی و معرفی نیازمندی‌ها',
            'dealKey'    => 'baran_deal',
            'status'     => 'Completed',
            'dateOffset' => '-3 days',
            'priority'   => 'Low',
        ],
    ];

    foreach ($tasksSeed as $t) {
        $opp = $oppEntities[$t['dealKey']] ?? null;
        if (!$opp) continue;

        $task = $taskRepo->where(['name' => $t['name'], 'parentId' => $opp->getId()])->findOne();
        if (!$task) {
            $em->createEntity('Task', [
                'name'        => $t['name'],
                'status'      => $t['status'],
                'priority'    => $t['priority'],
                'dateEnd'     => date('Y-m-d H:i:s', strtotime($t['dateOffset'])),
                'parentType'  => 'Opportunity',
                'parentId'    => $opp->getId(),
                'accountId'   => $opp->get('accountId'),
                'contactId'   => $opp->get('contactId'),
            ]);
            echo "   [+] وظیفه «{$t['name']}» ایجاد شد.\n";
        }
    }

    $callRepo = $em->getRepository('Call');
    $callsSeed = [
        ['name' => 'تماس تلفنی اولیه جهت استخراج الزامات فنی', 'dealKey' => 'kimia_deal', 'status' => 'Held', 'direction' => 'Outbound', 'dateOffset' => '-1 day'],
        ['name' => 'مکالمه با مدیریت بازرگانی در خصوص شرایط تخفیف', 'dealKey' => 'zarrin_deal', 'status' => 'Held', 'direction' => 'Inbound', 'dateOffset' => '-4 hours'],
    ];

    foreach ($callsSeed as $c) {
        $opp = $oppEntities[$c['dealKey']] ?? null;
        if (!$opp) continue;

        $call = $callRepo->where(['name' => $c['name'], 'parentId' => $opp->getId()])->findOne();
        if (!$call) {
            $em->createEntity('Call', [
                'name'       => $c['name'],
                'status'     => $c['status'],
                'direction'  => $c['direction'],
                'dateStart'  => date('Y-m-d H:i:s', strtotime($c['dateOffset'])),
                'parentType' => 'Opportunity',
                'parentId'   => $opp->getId(),
                'accountId'  => $opp->get('accountId'),
                'contactId'  => $opp->get('contactId'),
            ]);
            echo "   [+] تماس «{$c['name']}» ثبت شد.\n";
        }
    }

    // =========================================================================
    // ۶. جلسات و تقویم (Meetings & Calendar)
    // =========================================================================
    echo "\n۶. ایجاد جلسات و رویدادهای تقویم (Meetings & Calendar)...\n";
    $meetingRepo = $em->getRepository('Meeting');
    $meetingsSeed = [
        [
            'name'        => 'جلسه دمو آنلاین معماری کاریز فروش بیدار',
            'status'      => 'Planned',
            'dateStart'   => date('Y-m-d H:i:s', strtotime('today 10:00:00')),
            'dateEnd'     => date('Y-m-d H:i:s', strtotime('today 11:30:00')),
            'dealKey'     => 'kimia_deal',
            'description' => 'ارائه دمو آنلاین و قابلیت‌های اتوماسیون پیگیری معاملات برای تیم فروش کیمیا',
        ],
        [
            'name'        => 'جلسه بررسی مفاد قرارداد و SLA پشتیبانی زرین‌دشت',
            'status'      => 'Planned',
            'dateStart'   => date('Y-m-d H:i:s', strtotime('+1 day 14:00:00')),
            'dateEnd'     => date('Y-m-d H:i:s', strtotime('+1 day 15:30:00')),
            'dealKey'     => 'zarrin_deal',
            'description' => 'مذاکره نهایی با مدیر بازرگانی زرین‌دشت جهت نهایی‌سازی شرایط پرداخت',
        ],
        [
            'name'        => 'جلسه استخراج نیازمندی‌های وب‌سرویس باران',
            'status'      => 'Planned',
            'dateStart'   => date('Y-m-d H:i:s', strtotime('+2 days 11:00:00')),
            'dateEnd'     => date('Y-m-d H:i:s', strtotime('+2 days 12:30:00')),
            'dealKey'     => 'baran_deal',
            'description' => 'جلسه فنی مشترک با معاونت عملیات شرکت باران جهت اتصال هوش تجاری',
        ],
        [
            'name'        => 'جلسه حضوری تحویل پروژه و مستندات پتروشیمی سپهر',
            'status'      => 'Held',
            'dateStart'   => date('Y-m-d H:i:s', strtotime('-3 days 09:00:00')),
            'dateEnd'     => date('Y-m-d H:i:s', strtotime('-3 days 11:00:00')),
            'dealKey'     => 'sepehr_deal',
            'description' => 'جلسه در محل مجتمع عسلویه با حضور مهندس قادری برگزار و صورتجلسه امضا شد.',
        ],
        [
            'name'        => 'جلسه دوره‌ای بازبینی تارگت و استراتژی فروش سه‌ماهه',
            'status'      => 'Planned',
            'dateStart'   => date('Y-m-d H:i:s', strtotime('+4 days 09:30:00')),
            'dateEnd'     => date('Y-m-d H:i:s', strtotime('+4 days 11:00:00')),
            'dealKey'     => null,
            'description' => 'جلسه راهبردی داخلی تیم بازاریابی و فروش سازمانی بیدار',
        ],
    ];

    foreach ($meetingsSeed as $m) {
        $opp = $m['dealKey'] ? ($oppEntities[$m['dealKey']] ?? null) : null;
        $existing = $meetingRepo->where(['name' => $m['name']])->findOne();

        if (!$existing) {
            $em->createEntity('Meeting', [
                'name'        => $m['name'],
                'status'      => $m['status'],
                'dateStart'   => $m['dateStart'],
                'dateEnd'     => $m['dateEnd'],
                'description' => $m['description'],
                'parentType'  => $opp ? 'Opportunity' : null,
                'parentId'    => $opp ? $opp->getId() : null,
                'accountId'   => $opp ? $opp->get('accountId') : null,
            ]);
            echo "   [+] جلسه تقویم «{$m['name']}» ایجاد شد.\n";
        }
    }

    // =========================================================================
    // ۷. سرنخ‌های فروش (Leads)
    // =========================================================================
    echo "\n۷. ایجاد سرنخ‌های جدید فروش (Leads)...\n";
    $leadRepo = $em->getRepository('Lead');
    $leadsData = [
        [
            'firstName'         => 'سعید',
            'lastName'          => 'مقدم',
            'accountName'       => 'شرکت نوآوران ابری پارس',
            'title'             => 'مدیر زیرساخت و دواپس',
            'status'            => 'New',
            'source'            => 'Web Site',
            'opportunityAmount' => 75000000,
            'phoneNumber'       => '09129998877',
            'emailAddress'      => 's.moghadam@parsiandc.ir',
            'website'           => 'https://parsiandc.ir',
            'addressCity'       => 'تهران',
            'description'       => 'درخواست استعلام قیمت سرور اختصاصی و سیستم تیکتینگ یکپارچه از لندینگ سایت.',
        ],
        [
            'firstName'         => 'مهناز',
            'lastName'          => 'فرهمند',
            'accountName'       => 'گروه هتلداری و گردشگری سپید',
            'title'             => 'مدیر ارشد فروش و رزرواسیون',
            'status'            => 'Assigned',
            'source'            => 'Campaign',
            'opportunityAmount' => 110000000,
            'phoneNumber'       => '09174443322',
            'emailAddress'      => 'm.farahmand@sepidhotels.com',
            'website'           => 'https://sepidhotels.com',
            'addressCity'       => 'کیش',
            'description'       => 'ارتباط حاصل از کمپین بازاریابی دیجیتال زمستانه؛ نیازمند اتصال به پیامک و VoIP.',
        ],
        [
            'firstName'         => 'نیما',
            'lastName'          => 'صبوری',
            'accountName'       => 'صنایع تجهیزات پزشکی رازی',
            'title'             => 'سرپرست فروش تجهیزات بیمارستانی',
            'status'            => 'In Process',
            'source'            => 'Existing Customer',
            'opportunityAmount' => 185000000,
            'phoneNumber'       => '09142221100',
            'emailAddress'      => 'n.saboori@razimed.ir',
            'website'           => 'https://razimed.ir',
            'addressCity'       => 'تبریز',
            'description'       => 'معرفی شده توسط مدیریت پتروشیمی سپهر؛ جلسه دمو اولیه برای هفته آینده تنظیم شد.',
        ],
        [
            'firstName'         => 'پژمان',
            'lastName'          => 'طاهری',
            'accountName'       => 'شرکت حمل‌ونقل بین‌المللی شتاب',
            'title'             => 'معاونت بازرگانی و ترخیص کالا',
            'status'            => 'In Process',
            'source'            => 'Call',
            'opportunityAmount' => 220000000,
            'phoneNumber'       => '09176665544',
            'emailAddress'      => 'taheri@shetab-cargo.ir',
            'website'           => 'https://shetab-cargo.ir',
            'addressCity'       => 'بندرعباس',
            'description'       => 'نیاز به ردیابی حواله‌ها و یکپارچه‌سازی فرآیندهای انبارداری با CRM.',
        ],
        [
            'firstName'         => 'هدیه',
            'lastName'          => 'کریمی',
            'accountName'       => 'استارتاپ مالی زرین‌پِی',
            'title'             => 'بنیان‌گذار و مدیر محصول',
            'status'            => 'New',
            'source'            => 'Web Site',
            'opportunityAmount' => 90000000,
            'phoneNumber'       => '09123334411',
            'emailAddress'      => 'h.karimi@zarrinpay.io',
            'website'           => 'https://zarrinpay.io',
            'addressCity'       => 'تهران',
            'description'       => 'علاقه‌مند به وب‌هوک‌های دوطرفه و ماژول خودکار صادرکننده پیش‌فاکتور بیدار.',
        ],
    ];

    foreach ($leadsData as $ld) {
        $fullName = $ld['firstName'] . ' ' . $ld['lastName'];
        $existing = $leadRepo->where([
            'firstName' => $ld['firstName'],
            'lastName'  => $ld['lastName'],
        ])->findOne();

        if (!$existing) {
            $em->createEntity('Lead', $ld);
            echo "   [+] سرنخ «{$fullName}» ({$ld['accountName']}) ایجاد شد.\n";
        }
    }

    // =========================================================================
    // ۸. مکاتبات و ایمیل‌های سازمانی (Emails)
    // =========================================================================
    echo "\n۸. ایجاد ایمیل‌ها و مکاتبات سازمانی (Emails)...\n";
    $emailRepo = $em->getRepository('Email');
    $emailsData = [
        [
            'name'        => 'پیش‌فاکتور رسمی لایسنس و خدمات استقرار نرم‌افزار بیدار',
            'status'      => 'Sent',
            'fromAddress' => 'sales@bidarcrm.ir',
            'fromString'  => 'واحد فروش بیدار <sales@bidarcrm.ir>',
            'to'          => 'a.soleimani@kimiadata.ir',
            'dateSent'    => date('Y-m-d H:i:s', strtotime('-1 day 14:30:00')),
            'body'        => '<p>جناب مهندس سلیمانی گرامی،<br>با سلام و احترام،<br>پیرو مذاکرات فنی دیروز، پیش‌فاکتور رسمی سامانه جامع مدیریت فروش بیدار همراه با جزییات ماژول‌های کاریز و وب‌هوک VoIP ارسال می‌گردد.<br>لطفاً پس از بررسی، تاییدیه را اعلام فرمایید.<br><br>با تشکر،<br>واحد بازرگانی بیدار</p>',
            'dealKey'     => 'kimia_deal',
        ],
        [
            'name'        => 'تاییدیه زمان جلسه دمو آنلاین و لینک اتاق گفتگوی تصویری',
            'status'      => 'Sent',
            'fromAddress' => 'sales@bidarcrm.ir',
            'fromString'  => 'پشتیبانی فروش بیدار <sales@bidarcrm.ir>',
            'to'          => 'e.ghaderi@sepehr-pg.ir',
            'dateSent'    => date('Y-m-d H:i:s', strtotime('-2 days 10:15:00')),
            'body'        => '<p>جناب آقای مهندس قادری،<br>جلسه دمو آنلاین سیستم برای روز چهارشنبه هماهنگ گردید. کارشناسان ما پاسخگوی تمامی پرسش‌های تیم محترم پتروشیمی سپهر خواهند بود.<br><br>ارادتمند،<br>تیم توسعه بیدار</p>',
            'dealKey'     => 'sepehr_deal',
        ],
        [
            'name'        => 'پیش‌نویس قرارداد محرمانگی (NDA) و شرایط همکاری مشترک',
            'status'      => 'Sent',
            'fromAddress' => 'legal@bidarcrm.ir',
            'fromString'  => 'امور حقوقی و قراردادها <legal@bidarcrm.ir>',
            'to'          => 'b.moradi@baran-commerce.com',
            'dateSent'    => date('Y-m-d H:i:s', strtotime('-3 days 16:45:00')),
            'body'        => '<p>همکاران محترم شرکت تجارت الکترونیک باران،<br>نسخه اولیه توافق‌نامه سطح خدمات (SLA) و قرارداد حفظ محرمانگی داده‌ها به پیوست ارسال می‌شود.<br><br>با احترام، واحد حقوقی</p>',
            'dealKey'     => 'baran_deal',
        ],
        [
            'name'        => 'استعلام الزامات سخت‌افزاری و سیستم‌عامل سرور محلی',
            'status'      => 'Archived',
            'fromAddress' => 'ansari@zarrindasht.com',
            'fromString'  => 'مریم انصاری <ansari@zarrindasht.com>',
            'to'          => 'sales@bidarcrm.ir',
            'dateSent'    => date('Y-m-d H:i:s', strtotime('-4 days 09:20:00')),
            'body'        => '<p>سلام و عرض ادب،<br>لطفاً حداقل سیستم مورد نیاز جهت نصب On-Premise بیدار روی سرور لینوکس ابری را برای واحد انفورماتیک زرین‌دشت ارسال بفرمایید.<br><br>سپاس، انصاری</p>',
            'dealKey'     => 'zarrin_deal',
        ],
    ];

    foreach ($emailsData as $ed) {
        $existing = $emailRepo->where(['name' => $ed['name']])->findOne();
        $opp = $ed['dealKey'] ? ($oppEntities[$ed['dealKey']] ?? null) : null;

        if (!$existing) {
            $em->createEntity('Email', [
                'name'        => $ed['name'],
                'status'      => $ed['status'],
                'fromAddress' => $ed['fromAddress'],
                'fromString'  => $ed['fromString'],
                'to'          => $ed['to'],
                'dateSent'    => $ed['dateSent'],
                'body'        => $ed['body'],
                'isHtml'      => true,
                'parentType'  => $opp ? 'Opportunity' : null,
                'parentId'    => $opp ? $opp->getId() : null,
                'accountId'   => $opp ? $opp->get('accountId') : null,
            ]);
            echo "   [+] ایمیل «{$ed['name']}» ذخیره شد.\n";
        }
    }

    // =========================================================================
    // ۹. پایگاه دانش (KnowledgeBase Articles & Categories)
    // =========================================================================
    echo "\n۹. ایجاد پایگاه دانش و مستندات سازمانی (KnowledgeBase)...\n";
    $categoryRepo = $em->getRepository('KnowledgeBaseCategory');
    $categoriesConfig = [
        'sales'   => ['name' => 'راهنمای فروش و چرخه مذاکره سازمانی', 'description' => 'مستندات استاندارد فرآیند فروش و اصول ثبت فعالیت در بیدار'],
        'tech'    => ['name' => 'فرآیندهای استقرار و پشتیبانی فنی', 'description' => 'راهنماهای اتصال وب‌هوک، وب‌سرویس و امنیت سرور'],
        'finance' => ['name' => 'سیاست‌های مالی، پیش‌فاکتور و تخفیف‌ها', 'description' => 'ضوابط اعطای تخفیف، صدور پیش‌فاکتور و تسویه نقدی'],
    ];

    $categoryEntities = [];
    foreach ($categoriesConfig as $ckey => $cdata) {
        $cat = $categoryRepo->where(['name' => $cdata['name']])->findOne();
        if (!$cat) {
            $cat = $em->createEntity('KnowledgeBaseCategory', $cdata);
            echo "   [+] دسته‌بندی دانش «{$cdata['name']}» ایجاد شد.\n";
        }
        $categoryEntities[$ckey] = $cat;
    }

    $articleRepo = $em->getRepository('KnowledgeBaseArticle');
    $articlesData = [
        [
            'name'     => 'فرآیند استاندارد مدیریت معاملات در کاریز و پیشگیری از پوسیدگی (Rotten Deal)',
            'category' => 'sales',
            'body'     => '<p>در سامانه بیدار، هر مرحله کاریز دارای مهلت مجاز اقدام (Rotten Days) است. برای جلوگیری از پوسیده شدن معامله و حفظ دقت پیش‌بینی فروش، کارشناسان موظف هستند پس از هر تعامل با مشتری، نتیجه را در <strong>استریم ۳۶۰ درجه</strong> ثبت نموده و بلافاصله وظیفه بعدی را زمان‌بندی کنند.</p><p>با ثبت یادداشت یا تکمیل وظیفه، شاخص پوسیدگی بلافاصله سبز شده و تاریخ آخرین فعالیت به‌روزرسانی می‌گردد.</p>',
        ],
        [
            'name'     => 'چک‌لیست برگزاری جلسه پرزنت و ارائه دمو آنلاین برای مشتریان B2B',
            'category' => 'sales',
            'body'     => '<ol><li>استخراج پیش‌نیازها و چالش‌های فعلی مشتری قبل از جلسه از بخش جزئیات سرنخ یا معامله.</li><li>آماده‌سازی سناریوی دمو متناسب با صنعت مشتری (تولیدی، خدماتی یا بازرگانی).</li><li>ارائه ماژول کاریز فروش، مدیریت وظایف روزانه و تقویم شمسی.</li><li>ثبت صورتجلسه دمو در بخش جلسات (Meetings) بلافاصله پس از اتمام تماس.</li></ol>',
        ],
        [
            'name'     => 'قوانین و چارچوب اعطای تخفیف‌های تجاری و شرایط پرداخت نقدی',
            'category' => 'finance',
            'body'     => '<p>سقف تخفیف مجاز برای کارشناسان فروش حداکثر ۵ درصد (مشروط به تسویه نقدی پیش‌فاکتور ظرف ۵ روز کاری) می‌باشد. تخفیف‌های بالای ۱۰ درصد صرفاً با تایید مکتوب مدیریت ارشد بازرگانی و پس از ارزیابی حجم خرید سالانه مشتری قابل اعمال است.</p>',
        ],
        [
            'name'     => 'راهنمای الزامات سرور، بک‌آپ‌گیری روزانه و امنیت پایگاه‌داده',
            'category' => 'tech',
            'body'     => '<p>برای عملکرد بهینه نرم‌افزار، اجرای CronJob هر دقیقه یک‌بار با دستور <code>php cron.php</code> الزامی است. همچنین پشتیبان‌گیری خودکار شبانه از پایگاه‌داده MariaDB و پوشه <code>data/upload</code> باید در ساعت ۰۲:۰۰ بامداد زمان‌بندی گردد.</p>',
        ],
    ];

    foreach ($articlesData as $ad) {
        $existing = $articleRepo->where(['name' => $ad['name']])->findOne();
        if (!$existing) {
            $cat = $categoryEntities[$ad['category']] ?? null;
            $article = $em->createEntity('KnowledgeBaseArticle', [
                'name'        => $ad['name'],
                'status'      => 'Published',
                'body'        => $ad['body'],
                'isHtml'      => true,
                'description' => strip_tags(mb_substr($ad['body'], 0, 150)) . '...',
            ]);
            if ($cat) {
                $article->set('categoriesIds', [$cat->getId()]);
                $em->saveEntity($article);
            }
            echo "   [+] مقاله پایگاه دانش «{$ad['name']}» منتشر شد.\n";
        }
    }

    // =========================================================================
    // ۱۰. یادداشت‌های استریم ۳۶۰ درجه (Stream Notes)
    // =========================================================================
    echo "\n۱۰. ثبت یادداشت‌های استریم ۳۶۰ درجه مذاکرات...\n";
    $notesSeed = [
        ['dealKey' => 'kimia_deal', 'post' => 'جلسه ارائه دمو با حضور مهندس سلیمانی برگزار شد. بخش ماژول کاریز فروش بیدار مورد استقبال تیم فنی قرار گرفت.'],
        ['dealKey' => 'zarrin_deal', 'post' => 'درخواست تخفیف ۵ درصدی توسط مشتری ثبت شد؛ مشروط به تسویه نقدی پیش‌فاکتور موافقت گردید.'],
        ['dealKey' => 'sepehr_deal', 'post' => 'قرارداد نهایی امضا شد. نسخه چاپی با هولوگرام رسمی تحویل واحد اداری گردید.'],
        ['dealKey' => 'zist_deal', 'post' => 'تلاش برای تماس در تاریخ ۱۰ روز قبل بی‌نتیجه ماند. مشتری در سفر کاری بود.'],
    ];

    $noteRepo = $em->getRepository('Note');
    foreach ($notesSeed as $n) {
        $opp = $oppEntities[$n['dealKey']] ?? null;
        if (!$opp) continue;

        $note = $noteRepo->where(['parentId' => $opp->getId(), 'post' => $n['post']])->findOne();
        if (!$note) {
            $em->createEntity('Note', [
                'post'       => $n['post'],
                'type'       => 'Post',
                'parentType' => 'Opportunity',
                'parentId'   => $opp->getId(),
            ]);
            echo "   [+] یادداشت استریم برای معامله «{$opp->get('name')}» درج شد.\n";
        }
    }

    echo "\n============================================================\n";
    echo "🎉 عملیات تزریق جامع داده‌های نمونه با موفقیت ۱۰۰٪ انجام شد!\n";
    echo "خلاصه تمامی بخش‌های پر شده:\n";
    echo "  ✔ ۱ کاریز اصلی فروش با ۶ مرحله استاندارد\n";
    echo "  ✔ ۶ شرکت و مشتری سازمانی (Accounts)\n";
    echo "  ✔ ۶ مخاطب و تصمیم‌گیرنده کلیدی (Contacts)\n";
    echo "  ✔ ۶ معامله کاریز با مراحل متنوع و مقادیر ریالی معتبر (Opportunities)\n";
    echo "  ✔ ۵ وظیفه کاری در تب‌های امروز، فردا و معوق (Tasks)\n";
    echo "  ✔ ۲ تماس تلفنی ثبت‌شده (Calls)\n";
    echo "  ✔ ۵ جلسه تقویم شامل جلسات امروز، این هفته و گذشته (Meetings & Calendar)\n";
    echo "  ✔ ۵ سرنخ فروش فعال در وضعیت‌های مختلف (Leads)\n";
    echo "  ✔ ۴ ایمیل سازمانی ارسالی و دریافتی (Emails)\n";
    echo "  ✔ ۳ دسته‌بندی و ۴ مقاله تخصصی پایگاه دانش (KnowledgeBase Articles)\n";
    echo "  ✔ ۴ یادداشت استریم ۳۶۰ درجه مذاکرات (Stream Notes)\n";
    echo "============================================================\n";

} catch (\Throwable $e) {
    echo "\nخطا در هنگام تزریق داده‌ها: " . $e->getMessage() . "\n";
    exit(1);
}
