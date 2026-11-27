<?php
/**
 * BidarCRM - High-Quality Realistic Persian B2B Sample Data Seeder (CLI Wrapper)
 *
 * اسکریپت اجرای تزریق داده‌های نمونه و تجاری برای سامانه بیدار
 * با استفاده از کلاس متمرکز و چندباره‌پذیر (Idempotent):
 *   Espo\Modules\BidarSales\Seed\DemoDataSeeder
 *
 * نحوه اجرا:
 *   php scripts/seed-sample-data.php
 * یا در محیط داکر:
 *   docker exec bidarcrm-app php scripts/seed-sample-data.php
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Forbidden: CLI execution only.\n");
}

echo "============================================================\n";
echo "   سامانه بیدار (BidarCRM) - تولید داده‌های جامع و واقعی نمونه   \n";
echo "============================================================\n\n";

$bootstrapPaths = [
    __DIR__ . '/bootstrap.php',
    dirname(__DIR__) . '/bootstrap.php',
    dirname(__DIR__) . '/engine/bootstrap.php',
];

$bootstrapLoaded = false;
foreach ($bootstrapPaths as $bPath) {
    if (file_exists($bPath)) {
        require_once $bPath;
        $bootstrapLoaded = true;
        break;
    }
}

if (!$bootstrapLoaded) {
    die("خطا: فایل bootstrap.php یافت نشد. اسکریپت را در ریشه نصب یا با مسیر صحیح اجرا کنید.\n");
}

use Espo\Core\Application;
use Espo\Modules\BidarSales\Seed\DemoDataSeeder;

try {
    $app = new Application();
    $container = $app->getContainer();
    $container->get('applicationUser')->setupSystemUser();
    $em = $container->get('entityManager');

    echo " اتصال به پایگاه داده و هسته سیستم با موفقیت برقرار شد.\n\n";

    // =========================================================================
    // ۰. اعمال تنظیمات برند و وایت‌لیبل (Brand & White-Label Configuration)
    // =========================================================================
    echo "۰. بررسی و اعمال تنظیمات برند از config/brand.config.json...\n";
    $brandConfigFile = dirname(__DIR__) . '/config/brand.config.json';
    if (file_exists($brandConfigFile)) {
        $brandConfig = json_decode((string) file_get_contents($brandConfigFile), true);
        if (is_array($brandConfig)) {
            $nameFa = $brandConfig['nameFa'] ?? 'بیدار CRM';
            $outboundEmailFromName = $brandConfig['outboundEmailFromName'] ?? 'بیدار CRM';
            $defaultTab = $brandConfig['defaultDashboardTabName'] ?? 'نشانگر من';

            $configWriter = null;
            if ($container->has('injectableFactory')) {
                try {
                    $configWriter = $container->get('injectableFactory')->create(\Espo\Core\Utils\Config\ConfigWriter::class);
                } catch (\Throwable) {
                    // Fallback
                }
            }

            if ($configWriter) {
                $dashboardLayout = $container->get('config')->get('dashboardLayout') ?? [];
                if (empty($dashboardLayout)) {
                    $dashboardLayout = [(object) ['name' => $defaultTab, 'layout' => []]];
                } else {
                    foreach ($dashboardLayout as $tab) {
                        if (is_object($tab) && in_array($tab->name, ['My Espo', 'Espo', ''])) {
                            $tab->name = $defaultTab;
                        } elseif (is_array($tab) && in_array($tab['name'] ?? '', ['My Espo', 'Espo', ''])) {
                            $tab['name'] = $defaultTab;
                        }
                    }
                }

                $configUpdates = [
                    'applicationName' => $nameFa,
                    'outboundEmailFromName' => $outboundEmailFromName,
                    'adminNotificationsNewVersion' => false,
                    'adminNotificationsNewExtensionVersion' => false,
                    'adminPanelIframeDisabled' => true,
                    'dashboardLayout' => $dashboardLayout,
                    'language' => 'fa_IR',
                    'timeZone' => 'Asia/Tehran',
                    'weekStart' => 6,
                    'dateFormat' => 'YYYY/MM/DD',
                    'timeFormat' => 'HH:mm',
                    'thousandSeparator' => ',',
                    'decimalMark' => '.',
                    'currencyList' => ['IRT', 'IRR'],
                    'defaultCurrency' => 'IRT',
                    'baseCurrency' => 'IRT',
                    'currencyFormat' => 2,
                    'currencyDecimalPlaces' => 0,
                    'phoneNumberPreferredCountryList' => ['ir'],
                    'phoneNumberInternational' => false,
                ];

                $configWriter->setMultiple($configUpdates);
                $configWriter->save();
                echo "   [+] تنظیمات برند «{$nameFa}» با موفقیت در پیکربندی ذخیره شد.\n\n";
            }
        }
    }

    // =========================================================================
    // دریافت شناسه کاربر مدیر (Admin User)
    // =========================================================================
    $adminUserId = null;
    try {
        $userRepo = $em->getRepository('User');
        $adminUser = $userRepo->where(['isAdmin' => true, 'deleted' => false])->findOne();
        if ($adminUser) {
            $adminUserId = $adminUser->getId();
            echo " کاربری مدیر پیدا شد: «{$adminUser->get('userName')}» (شناسه: {$adminUserId})\n\n";
        }
    } catch (\Throwable $e) {
        // Fallback if user table query fails
    }

    // =========================================================================
    // فراخوانی DemoDataSeeder
    // =========================================================================
    $seeder = new DemoDataSeeder($em);
    $logger = function (string $msg): void {
        echo $msg . "\n";
    };

    $summary = $seeder->seed($adminUserId, $logger);

    echo "\n============================================================\n";
    echo "🎉 عملیات تزریق جامع داده‌های نمونه با موفقیت ۱۰۰٪ انجام شد!\n";
    echo "خلاصه تمامی بخش‌های پر شده:\n";
    echo "  ✔ {$summary['pipelines']} کاریز اصلی فروش با {$summary['pipelineStages']} مرحله استاندارد\n";
    echo "  ✔ {$summary['accounts']} شرکت و مشتری سازمانی (Accounts)\n";
    echo "  ✔ {$summary['contacts']} مخاطب و تصمیم‌گیرنده کلیدی (Contacts)\n";
    echo "  ✔ {$summary['opportunities']} معامله کاریز (شامل معامله راکد و شکست‌خورده با دلیل)\n";
    echo "  ✔ {$summary['products']} محصول نمونه بیدار (BidarProduct)\n";
    echo "  ✔ {$summary['dealItems']} قلم کالای نمونه روی معاملات (BidarDealItem)\n";
    echo "  ✔ {$summary['goals']} هدف فروش ماهانه شمسی (BidarGoal)\n";
    echo "  ✔ {$summary['smsTemplates']} قالب آماده پیامک (BidarSmsTemplate)\n";
    echo "  ✔ {$summary['tasks']} وظیفه کاری در تب‌های امروز، فردا و معوق (Tasks)\n";
    echo "  ✔ {$summary['calls']} تماس تلفنی ثبت‌شده (Calls)\n";
    echo "  ✔ {$summary['meetings']} جلسه تقویم (Meetings & Calendar)\n";
    echo "  ✔ {$summary['leads']} سرنخ فروش فعال (Leads)\n";
    echo "  ✔ {$summary['notes']} یادداشت استریم ۳۶۰ درجه مذاکرات (Stream Notes)\n";
    echo "============================================================\n";

} catch (\Throwable $e) {
    echo "\nخطا در هنگام تزریق داده‌ها: " . $e->getMessage() . "\n";
    exit(1);
}
