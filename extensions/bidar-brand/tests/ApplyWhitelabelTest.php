<?php

declare(strict_types=1);

namespace Espo\Modules\BidarBrand\Tests;

use Bidar\Whitelabel\WhiteLabelApplier;
use PHPUnit\Framework\TestCase;

class ApplyWhitelabelTest extends TestCase
{
    private string $tempDir;
    private string $rootDir;
    private string $brandConfigFile;

    protected function setUp(): void
    {
        $this->rootDir = dirname(__DIR__, 3);
        $this->brandConfigFile = $this->rootDir . '/config/brand.config.json';
        $this->tempDir = sys_get_temp_dir() . '/bidar_whitelabel_test_' . uniqid();
        mkdir($this->tempDir, 0755, true);
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->tempDir);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    public function testBrandConfigJsonIsValidAndHasRequiredFields(): void
    {
        $this->assertFileExists($this->brandConfigFile);
        $content = file_get_contents($this->brandConfigFile);
        $data = json_decode($content, true);

        $this->assertIsArray($data);
        $this->assertSame('bidar', $data['brandId']);
        $this->assertSame('Bidar CRM', $data['name']);
        $this->assertSame('بیدار CRM', $data['nameFa']);
        $this->assertSame('بیدار', $data['shortName']);
        $this->assertSame('https://bidarcrm.ir', $data['websiteUrl']);
        $this->assertSame('https://bidarcrm.ir/support', $data['supportUrl']);
        $this->assertSame('نشانگر من', $data['defaultDashboardTabName']);
        $this->assertArrayHasKey('assets', $data);
        $this->assertArrayHasKey('colors', $data);
        $this->assertContains('extensions', $data['adminHideExternalItems']);
        $this->assertContains('upgrade', $data['adminHideExternalItems']);
    }

    public function testBidarBrandModuleFilesExistAndAreValid(): void
    {
        $moduleDir = $this->rootDir . '/extensions/bidar-brand';

        // Manifest
        $manifestPath = $moduleDir . '/manifest.json';
        $this->assertFileExists($manifestPath);
        $manifest = json_decode(file_get_contents($manifestPath), true);
        $this->assertSame('BidarBrand', $manifest['name']);
        $this->assertSame('1.0.5', $manifest['version']);

        // Module.json
        $modulePath = $moduleDir . '/Resources/module.json';
        $this->assertFileExists($modulePath);
        $module = json_decode(file_get_contents($modulePath), true);
        $this->assertSame(90, $module['order']);

        // AdminPanel metadata
        $adminPanelPath = $moduleDir . '/Resources/metadata/app/adminPanel.json';
        $this->assertFileExists($adminPanelPath);
        $adminPanel = json_decode(file_get_contents($adminPanelPath), true);
        $this->assertArrayHasKey('system', $adminPanel);
        $urls = array_column($adminPanel['system']['itemList'] ?? [], 'url');
        $this->assertNotContains('#Admin/extensions', $urls);
        $this->assertNotContains('#Admin/upgrade', $urls);

        // Config metadata
        $configMetadataPath = $moduleDir . '/Resources/metadata/app/config.json';
        $this->assertFileExists($configMetadataPath);
        $configMeta = json_decode(file_get_contents($configMetadataPath), true);
        $this->assertSame('بیدار CRM', $configMeta['applicationName']);
        $this->assertFalse($configMeta['adminNotificationsNewVersion']);

        // i18n files
        $i18nFiles = [
            'fa_IR/Global.json',
            'fa_IR/Admin.json',
            'fa_IR/Settings.json',
            'fa_IR/ScheduledJob.json',
            'en_US/Global.json',
            'en_US/Admin.json',
            'en_US/Settings.json',
            'en_US/ScheduledJob.json',
        ];
        foreach ($i18nFiles as $rel) {
            $path = $moduleDir . '/Resources/i18n/' . $rel;
            $this->assertFileExists($path, "Missing i18n file: {$rel}");
            $decoded = json_decode(file_get_contents($path), true);
            $this->assertIsArray($decoded, "Invalid JSON in: {$rel}");
        }
    }

    public function testFromConfigFilesThrowsOnNonExistentTarget(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        WhiteLabelApplier::fromConfigFiles('/non/existent/path/12345', $this->brandConfigFile);
    }

    public function testFromConfigFilesThrowsOnNonExistentBrand(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        WhiteLabelApplier::fromConfigFiles($this->tempDir, '/non/existent/brand.json');
    }

    public function testApplyWhitelabelPatchesAllTargetFiles(): void
    {
        $this->createMockTargetStructure($this->tempDir);

        $applier = WhiteLabelApplier::fromConfigFiles($this->tempDir, $this->brandConfigFile, $this->rootDir);
        $results = $applier->apply();

        $this->assertTrue($results['mainHtml']);
        $this->assertTrue($results['siteFooter']);
        $this->assertTrue($results['aboutTemplate']);
        $this->assertTrue($results['installerTpl']);
        $this->assertTrue($results['installerI18n']);
        $this->assertTrue($results['assets']);
        $this->assertTrue($results['defaultConfig']);
        $this->assertTrue($results['notice']);

        // Assert 1: EspoCRM, Inc. is gone from main.html, site/footer.tpl, install/core/tpl/footer.tpl
        $mainHtml = file_get_contents($this->tempDir . '/html/main.html');
        $this->assertStringNotContainsString('EspoCRM, Inc.', $mainHtml);
        $this->assertStringContainsString('بیدار CRM', $mainHtml);
        $this->assertStringContainsString('https://bidarcrm.ir', $mainHtml);

        $siteFooter = file_get_contents($this->tempDir . '/client/res/templates/site/footer.tpl');
        $this->assertStringNotContainsString('EspoCRM, Inc.', $siteFooter);
        $this->assertStringContainsString('بیدار CRM', $siteFooter);

        $installFooter = file_get_contents($this->tempDir . '/install/core/tpl/footer.tpl');
        $this->assertStringNotContainsString('EspoCRM, Inc.', $installFooter);
        $this->assertStringContainsString('بیدار CRM', $installFooter);

        // Assert 2: About template has brand info
        $aboutTpl = file_get_contents($this->tempDir . '/client/res/templates/about.tpl');
        $this->assertStringContainsString('بیدار CRM', $aboutTpl);
        $this->assertStringContainsString('https://bidarcrm.ir', $aboutTpl);

        // Assert 3: Installer i18n
        $faInstall = json_decode(file_get_contents($this->tempDir . '/install/core/i18n/fa_IR/install.json'), true);
        $this->assertSame('نصب بیدار CRM', $faInstall['labels']['headerTitle']);
        $this->assertSame('به بیدار CRM خوش آمدید', $faInstall['labels']['Main page title']);
        $this->assertSame('تبریک! بیدار CRM با موفقیت نصب شد.', $faInstall['labels']['Congratulation! Welcome to EspoCRM']);
        $this->assertSame('ورود به بیدار CRM', $faInstall['labels']['Go to EspoCRM']);

        $enInstall = json_decode(file_get_contents($this->tempDir . '/install/core/i18n/en_US/install.json'), true);
        $this->assertSame('Bidar CRM Installation', $enInstall['labels']['headerTitle']);
        $this->assertSame('Welcome to Bidar CRM', $enInstall['labels']['Main page title']);
        $this->assertSame('Congratulations! Bidar CRM has been successfully installed.', $enInstall['labels']['Congratulation! Welcome to EspoCRM']);
        $this->assertSame('Go to Bidar CRM', $enInstall['labels']['Go to EspoCRM']);

        // Assert 4: Defaults config
        $defaultsConfig = include $this->tempDir . '/application/Espo/Resources/defaults/config.php';
        $this->assertIsArray($defaultsConfig);
        $this->assertSame('بیدار CRM', $defaultsConfig['applicationName']);
        $this->assertSame('بیدار CRM', $defaultsConfig['outboundEmailFromName']);
        $this->assertSame('Bidar', $defaultsConfig['theme']);
        $this->assertSame('fa_IR', $defaultsConfig['language']);
        $this->assertSame('Asia/Tehran', $defaultsConfig['timeZone']);
        $this->assertSame(6, $defaultsConfig['weekStart']);
        $this->assertSame('YYYY/MM/DD', $defaultsConfig['dateFormat']);
        $this->assertSame('HH:mm', $defaultsConfig['timeFormat']);
        $this->assertSame(',', $defaultsConfig['thousandSeparator']);
        $this->assertSame('.', $defaultsConfig['decimalMark']);
        $this->assertSame(['IRT', 'IRR'], $defaultsConfig['currencyList']);
        $this->assertSame('IRT', $defaultsConfig['defaultCurrency']);
        $this->assertSame('IRT', $defaultsConfig['baseCurrency']);
        $this->assertSame(2, $defaultsConfig['currencyFormat']);
        $this->assertSame(0, $defaultsConfig['currencyDecimalPlaces']);
        $this->assertSame(['ir'], $defaultsConfig['phoneNumberPreferredCountryList']);
        $this->assertFalse($defaultsConfig['phoneNumberInternational']);
        $this->assertFalse($defaultsConfig['adminNotificationsNewVersion']);
        $this->assertTrue($defaultsConfig['adminPanelIframeDisabled']);
        $this->assertSame('نشانگر من', $defaultsConfig['dashboardLayout'][0]->name);

        // Assert 5: NOTICE.txt
        $noticeFile = $this->tempDir . '/NOTICE.txt';
        $this->assertFileExists($noticeFile);
        $noticeContent = file_get_contents($noticeFile);
        $this->assertStringContainsString('Bidar CRM', $noticeContent);
        $this->assertStringContainsString('EspoCRM', $noticeContent);
        $this->assertStringContainsString('GNU Affero General Public License', $noticeContent);
        $this->assertStringContainsString('Section 7(b)', $noticeContent);

        // Assert 6: Brand assets copied
        $this->assertFileExists($this->tempDir . '/client/img/logo.svg');
        $this->assertFileExists($this->tempDir . '/client/img/logo-light.svg');
        $this->assertFileExists($this->tempDir . '/client/img/logo-dark.svg');
        $this->assertFileExists($this->tempDir . '/client/img/favicon.svg');
    }

    public function testApplyUsesCustomBrandForInstallerThemeLabels(): void
    {
        $this->createMockTargetStructure($this->tempDir);

        $brand = json_decode((string) file_get_contents($this->brandConfigFile), true);
        $this->assertIsArray($brand);
        $brand['name'] = 'Acme CRM';
        $brand['nameFa'] = 'اکمی';
        $brand['shortName'] = 'اکمی';

        $applier = new WhiteLabelApplier($this->tempDir, $brand, $this->rootDir);
        $applier->apply();

        $faInstall = json_decode((string) file_get_contents($this->tempDir . '/install/core/i18n/fa_IR/install.json'), true);
        $enInstall = json_decode((string) file_get_contents($this->tempDir . '/install/core/i18n/en_US/install.json'), true);

        $this->assertSame('اکمی (پیش‌فرض RTL)', $faInstall['themes']['Bidar']);
        $this->assertSame('Acme CRM (Default RTL)', $enInstall['themes']['Bidar']);
        $this->assertStringNotContainsString('بیدار', $faInstall['themes']['Bidar']);
        $this->assertStringNotContainsString('Bidar', $enInstall['themes']['Bidar']);
    }

    public function testApplyWhitelabelIsIdempotent(): void
    {
        $this->createMockTargetStructure($this->tempDir);

        $applier = WhiteLabelApplier::fromConfigFiles($this->tempDir, $this->brandConfigFile, $this->rootDir);
        $firstRun = $applier->apply();
        $this->assertTrue($firstRun['mainHtml']);

        // Run second time on already patched directory
        $secondRun = $applier->apply();
        $this->assertTrue($secondRun['mainHtml']);
        $this->assertTrue($secondRun['siteFooter']);
        $this->assertTrue($secondRun['aboutTemplate']);

        // Assert no duplicate corrupted tags in main.html
        $mainHtml = file_get_contents($this->tempDir . '/html/main.html');
        $this->assertStringNotContainsString('EspoCRM, Inc.', $mainHtml);
        $this->assertSame(1, substr_count($mainHtml, 'https://bidarcrm.ir'));

        // Assert defaults/config.php still parses cleanly and has expected values
        $defaultsConfig = include $this->tempDir . '/application/Espo/Resources/defaults/config.php';
        $this->assertSame('بیدار CRM', $defaultsConfig['applicationName']);
    }

    public function testPatchInstallerDemoDataSeederCompletesFlowAndIsIdempotent(): void
    {
        mkdir($this->tempDir . '/install/core/tpl', 0755, true);
        mkdir($this->tempDir . '/install/core/actions', 0755, true);
        mkdir($this->tempDir . '/public/install/js', 0755, true);
        file_put_contents($this->tempDir . '/install/core/tpl/step4.tpl', '<form>Install</form>');
        file_put_contents($this->tempDir . '/public/install/js/install.js', <<<'JS'
this.systemSettings.language = $('[name="language"]').val();
.done(ajaxData => {
			if (typeof(ajaxData) != 'undefined' && ajaxData.success) {
				self.goTo(nextAction);
			}
		});
JS
        );
        file_put_contents($this->tempDir . '/install/core/Utils.php', "<?php\nreturn ['step5',];\n");
        file_put_contents($this->tempDir . '/install/core/Installer.php', "<?php\nclass Installer {\n    private function getContainer(): Container {}\n}\n");

        $this->assertTrue(WhiteLabelApplier::patchInstallerDemoDataSeeder($this->tempDir, $this->rootDir));
        $step4 = (string) file_get_contents($this->tempDir . '/install/core/tpl/step4.tpl');
        $installJs = (string) file_get_contents($this->tempDir . '/public/install/js/install.js');
        $utils = (string) file_get_contents($this->tempDir . '/install/core/Utils.php');
        $installer = (string) file_get_contents($this->tempDir . '/install/core/Installer.php');
        $action = (string) file_get_contents($this->tempDir . '/install/core/actions/seedDemoData.php');
        $this->assertStringContainsString('name="importDemoData"', $step4);
        $this->assertStringContainsString('this.systemSettings.importDemoData', $installJs);
        $this->assertStringContainsString("'seedDemoData'", $installJs);
        $this->assertStringContainsString("'seedDemoData'", $utils);
        $this->assertStringContainsString('function getApplication', $installer);
        $this->assertStringContainsString('class_exists(\\Espo\\Modules\\BidarSales\\Seed\\DemoDataSeeder::class)', $action);
        $this->assertStringContainsString('while (ob_get_level() > 0)', $action);

        $snapshot = [$step4, $installJs, $utils, $installer, $action];
        $this->assertTrue(WhiteLabelApplier::patchInstallerDemoDataSeeder($this->tempDir, $this->rootDir));
        $this->assertSame($snapshot, [
            file_get_contents($this->tempDir . '/install/core/tpl/step4.tpl'),
            file_get_contents($this->tempDir . '/public/install/js/install.js'),
            file_get_contents($this->tempDir . '/install/core/Utils.php'),
            file_get_contents($this->tempDir . '/install/core/Installer.php'),
            file_get_contents($this->tempDir . '/install/core/actions/seedDemoData.php'),
        ]);
    }

    public function testMultiLineConfigArraysAreReplacedWithoutDuplicateKeys(): void
    {
        $this->createMockTargetStructure($this->tempDir);
        $configPath = $this->tempDir . '/application/Espo/Resources/defaults/config.php';
        file_put_contents($configPath, <<<'PHP'
<?php
return [
    'currencyList' => [
        'USD',
        'EUR',
    ],
    'phoneNumberPreferredCountryList' => [
        'us',
        'ca',
    ],
];
PHP
        );
        $applier = WhiteLabelApplier::fromConfigFiles($this->tempDir, $this->brandConfigFile, $this->rootDir);
        $this->assertTrue($applier->patchDefaultsConfig());

        $source = (string) file_get_contents($configPath);
        $config = include $configPath;
        $this->assertIsArray($config);
        $this->assertSame(['IRT', 'IRR'], $config['currencyList']);
        $this->assertSame(['ir'], $config['phoneNumberPreferredCountryList']);
        $this->assertSame(1, substr_count($source, "'currencyList'"));
        $this->assertSame(1, substr_count($source, "'phoneNumberPreferredCountryList'"));
    }

    public function testBrandValuesAreHtmlEscapedAndPreservedInPhpConfig(): void
    {
        $this->createMockTargetStructure($this->tempDir);
        $name = 'Brand $1 \\1 & " <tag>';
        $nameFa = 'NameFa $1 \\1 & " <tag>';
        $tagline = 'Tag $1 \\1 & " <tag>';
        $copyright = 'Copy $1 \\1 & " <tag>';
        $brand = [
            'name' => $name,
            'nameFa' => $nameFa,
            'websiteUrl' => 'https://example.test/?q=$1&x="<',
            'supportUrl' => 'https://example.test/help?q=$1&x="<',
            'taglineFa' => $tagline,
            'copyrightFa' => $copyright,
            'assets' => [],
            'colors' => [],
        ];
        $applier = new WhiteLabelApplier($this->tempDir, $brand, $this->rootDir);
        $this->assertTrue($applier->patchMainHtml());
        $this->assertTrue($applier->patchSiteFooter());
        $this->assertTrue($applier->patchAboutTemplate());
        $this->assertTrue($applier->patchInstallerTemplates());
        $this->assertTrue($applier->patchDefaultsConfig());

        $escapedNameFa = htmlspecialchars($nameFa, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $escapedSupportUrl = htmlspecialchars($brand['supportUrl'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        foreach ([
            $this->tempDir . '/html/main.html',
            $this->tempDir . '/client/res/templates/site/footer.tpl',
            $this->tempDir . '/client/res/templates/about.tpl',
            $this->tempDir . '/install/core/tpl/footer.tpl',
        ] as $path) {
            $content = (string) file_get_contents($path);
            $this->assertStringContainsString($escapedNameFa, $content, $path);
            $this->assertStringNotContainsString('<tag>', $content, $path);
        }
        foreach (['main.tpl', 'finish.tpl'] as $template) {
            $content = (string) file_get_contents($this->tempDir . '/install/core/tpl/' . $template);
            $this->assertStringContainsString($escapedSupportUrl, $content, $template);
            $this->assertStringNotContainsString($brand['supportUrl'], $content, $template);
        }
        $installMain = (string) file_get_contents($this->tempDir . '/install/core/tpl/main.tpl');
        $this->assertStringContainsString(htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), $installMain);
        $config = include $this->tempDir . '/application/Espo/Resources/defaults/config.php';
        $this->assertSame($nameFa, $config['applicationName']);
        $this->assertSame($nameFa, $config['outboundEmailFromName']);
    }

    public function testMalformedInstallerJsonThrowsInsteadOfReplacingTranslations(): void
    {
        mkdir($this->tempDir . '/install/core/i18n/fa_IR', 0755, true);
        file_put_contents($this->tempDir . '/install/core/i18n/fa_IR/install.json', '{ malformed');
        $applier = new WhiteLabelApplier($this->tempDir, ['name' => 'Example']);

        $this->expectException(\RuntimeException::class);
        $applier->patchInstallerI18n();
    }

    public function testCopyBrandAssetsDoesNotWriteSvgBytesToFaviconIcoWithoutConfiguredIco(): void
    {
        $assetDir = $this->tempDir . '/brand-assets';
        mkdir($assetDir, 0755, true);
        file_put_contents($assetDir . '/logo.svg', '<svg>logo</svg>');
        file_put_contents($assetDir . '/favicon.svg', '<svg>favicon</svg>');
        mkdir($this->tempDir . '/client/img', 0755, true);
        $applier = new WhiteLabelApplier($this->tempDir, [
            'name' => 'Example',
            'assets' => [
                'logoLight' => $assetDir . '/logo.svg',
                'faviconSvg' => $assetDir . '/favicon.svg',
            ],
        ], $this->rootDir);

        $this->assertTrue($applier->copyBrandAssets());
        $this->assertFileExists($this->tempDir . '/client/img/favicon.svg');
        $this->assertFileDoesNotExist($this->tempDir . '/client/img/favicon.ico');
    }

    private function createMockTargetStructure(string $dir): void
    {
        mkdir($dir . '/html', 0755, true);
        file_put_contents($dir . '/html/main.html', <<<HTML
<!DOCTYPE html>
<html>
    <head><title>Test</title></head>
    <body>
        <div class="container content"></div>
        <footer>
            <p class="credit small">&copy; 2026
            <a href="https://www.espocrm.com" title="Powered by EspoCRM" rel="noopener" target="_blank">EspoCRM, Inc.</a></p>
        </footer>
    </body>
</html>
HTML
        );

        mkdir($dir . '/client/res/templates/site', 0755, true);
        file_put_contents($dir . '/client/res/templates/site/footer.tpl', <<<TPL
<p class="credit small">&copy; 2026
<a
    href="https://www.espocrm.com"
    title="Powered by EspoCRM"
    rel="noopener" target="_blank"
    tabindex="-1"
>EspoCRM, Inc.</a></p>
TPL
        );

        file_put_contents($dir . '/client/res/templates/about.tpl', <<<TPL
<div class="page-header"><h3>{{translate 'About'}}</h3></div>
<div class="complex-text">{{text}}</div>
TPL
        );

        mkdir($dir . '/install/core/tpl', 0755, true);
        file_put_contents($dir . '/install/core/tpl/footer.tpl', '<p class="credit small">&copy; 2025 <a href="https://www.espocrm.com">EspoCRM, Inc.</a></p>');
        file_put_contents($dir . '/install/core/tpl/main.tpl', '<img src="img/start.png" alt="EspoCRM"><a href="https://www.espocrm.com/documentation/administration/installation/">Docs</a>');
        file_put_contents($dir . '/install/core/tpl/finish.tpl', '<a href="https://www.espocrm.com/documentation/administration/server-configuration/#user-content-setup-a-crontab">Crontab</a>');
        file_put_contents($dir . '/install/core/tpl/index.tpl', '<link rel="shortcut icon" href="../client/img/favicon.ico" type="image/x-icon">');

        mkdir($dir . '/install/core/i18n/fa_IR', 0755, true);
        file_put_contents($dir . '/install/core/i18n/fa_IR/install.json', json_encode([
            'labels' => [
                'headerTitle' => 'نصب EspoCRM',
                'Main page title' => 'به EspoCRM خوش آمدید',
                'Congratulation! Welcome to EspoCRM' => 'تبریک! EspoCRM با موفقیت نصب شده است.',
                'Go to EspoCRM' => 'برو به EspoCRM',
            ],
            'messages' => [
                'phpVersion' => 'نسخه PHP شما توسط EspoCRM پشتیبانی نمی شود',
            ]
        ], JSON_PRETTY_PRINT));

        mkdir($dir . '/install/core/i18n/en_US', 0755, true);
        file_put_contents($dir . '/install/core/i18n/en_US/install.json', json_encode([
            'labels' => [
                'headerTitle' => 'EspoCRM Installation',
                'Main page title' => 'Welcome to EspoCRM',
                'Congratulation! Welcome to EspoCRM' => 'Congratulation! EspoCRM has been successfully installed.',
                'Go to EspoCRM' => 'Go to EspoCRM',
            ],
            'messages' => [
                'phpVersion' => 'Your PHP version is not supported by EspoCRM',
            ]
        ], JSON_PRETTY_PRINT));

        mkdir($dir . '/application/Espo/Resources/defaults', 0755, true);
        file_put_contents($dir . '/application/Espo/Resources/defaults/config.php', <<<PHP
<?php
return [
    'applicationName' => 'EspoCRM',
    'outboundEmailFromName' => 'EspoCRM',
    'timeZone' => 'UTC',
    'weekStart' => 0,
    'currencyList' => ['USD'],
    'defaultCurrency' => 'USD',
    'baseCurrency' => 'USD',
    'adminNotificationsNewVersion' => true,
    'dashboardLayout' => [
        (object) [
            'name' => 'My Espo',
            'layout' => []
        ],
    ],
];
PHP
        );
    }
}
