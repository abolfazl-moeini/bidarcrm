<?php
declare(strict_types=1);

namespace BidarTheme\Tests;

use PHPUnit\Framework\TestCase;

class BidarThemeMetadataTest extends TestCase
{
    private string $extDir;
    private string $clientDir;

    protected function setUp(): void
    {
        $this->extDir = dirname(__DIR__);
        $this->clientDir = dirname($this->extDir, 2) . '/client/custom/modules/bidar-theme';
    }

    public function testManifestIsValid(): void
    {
        $file = $this->extDir . '/manifest.json';
        $this->assertFileExists($file);

        $json = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($json);
        $this->assertSame('BidarTheme', $json['name']);
        $this->assertSame('1.0.5', $json['version']);
        $this->assertContains('>=10.1.0', $json['acceptableVersions']);
        $this->assertContains('>=8.3', $json['php']);
    }

    public function testModuleJsonIsValid(): void
    {
        $file = $this->extDir . '/Resources/module.json';
        $this->assertFileExists($file);

        $json = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($json);
        $this->assertSame(60, $json['order']);
        $this->assertTrue($json['bundled']);
        $this->assertTrue($json['jsTranspiled']);
    }

    public function testThemeMetadataBidarJson(): void
    {
        $file = $this->extDir . '/Resources/metadata/themes/Bidar.json';
        $this->assertFileExists($file);

        $json = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($json);
        $this->assertSame('client/custom/modules/bidar-theme/css/bidar.css', $json['stylesheet']);
        $this->assertSame('client/custom/modules/bidar-theme/css/bidar-iframe.css', $json['stylesheetIframe']);
        $this->assertSame('client/custom/modules/bidar-theme/img/bidar-logo.svg', $json['logo']);
        $this->assertSame('rtl', $json['params']['direction']['default']);
        $this->assertSame('side', $json['params']['navbar']['default']);
        $this->assertSame(48, $json['navbarHeight']);
        $this->assertSame(48, $json['mappedParams']['navbarHeight']['valueMap']['side']);
    }

    public function testClientMetadataScripts(): void
    {
        $file = $this->extDir . '/Resources/metadata/app/client.json';
        $this->assertFileExists($file);

        $json = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($json);
        $this->assertContains('client/custom/modules/bidar-theme/js/appearance.js', $json['scriptList']);
        $this->assertContains('client/custom/modules/bidar-theme/lib/init.js', $json['scriptList']);
        $this->assertContains('client/custom/modules/bidar-theme/js/nav-groups.js', $json['scriptList']);
    }

    public function testClientDefsGlobal(): void
    {
        $file = $this->extDir . '/Resources/metadata/clientDefs/Global.json';
        $this->assertFileExists($file);

        $json = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($json);
        $handlers = $json['viewSetupHandlers'];
        $this->assertArrayHasKey('record/detail', $handlers);
        $this->assertArrayHasKey('list', $handlers);
        $this->assertArrayHasKey('login', $handlers);
    }

    public function testPersianTranslationsExist(): void
    {
        $file = $this->extDir . '/Resources/i18n/fa_IR/Global.json';
        $this->assertFileExists($file);

        $json = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($json);
        $this->assertArrayHasKey('Bidar', $json['themes']);
        $this->assertArrayHasKey('bidarShowEmptyOne', $json['labels']);
    }

    public function testClientAssetsExist(): void
    {
        $this->assertFileExists($this->clientDir . '/css/bidar.css');
        $this->assertFileExists($this->clientDir . '/css/bidar-rtl.css');
        $this->assertFileExists($this->clientDir . '/fonts/vazirmatn/Vazirmatn-Variable.woff2');
        $this->assertFileExists($this->clientDir . '/img/bidar-logo.svg');
        $this->assertFileExists($this->clientDir . '/lib/init.js');
        $this->assertFileExists($this->clientDir . '/lib/module-bidar-theme.js');
    }

    public function testMonospaceFontPreservation(): void
    {
        $fontsCss = (string) file_get_contents($this->clientDir . '/css/bidar-fonts.css');
        $this->assertStringContainsString('code,', $fontsCss);
        $this->assertStringContainsString('pre,', $fontsCss);
        $this->assertStringContainsString('.ace_editor', $fontsCss);
        $this->assertStringContainsString('monospace !important', $fontsCss);
    }

    public function testRtlCornerAccentAndKanbanStyling(): void
    {
        $dataCss = (string) file_get_contents($this->clientDir . '/css/bidar-data.css');
        $rtlCss = (string) file_get_contents($this->clientDir . '/css/bidar-rtl.css');
        $darkCss = (string) file_get_contents($this->clientDir . '/css/bidar-dark.css');

        // The base accent belongs to data.css; its mirrored RTL rule is in rtl.css.
        $this->assertStringNotContainsString('html[dir="rtl"] #main > .list-container > .list::before', $dataCss);
        $this->assertStringContainsString('#main > .list-container > .list::before', $dataCss);
        $this->assertStringContainsString('border-inline-start: 3px solid var(--bidar-signature)', $dataCss);
        $this->assertStringContainsString('html[dir="rtl"] #main > .list-container > .list::before', $rtlCss);
        $this->assertStringContainsString('border-right: 3px solid var(--bidar-signature)', $rtlCss);
        $this->assertStringContainsString('border-top-right-radius', $rtlCss);

        // Native Kanban styling in data.css
        $this->assertStringContainsString('div.list-kanban', $dataCss);
        $this->assertStringContainsString('table.kanban-columns td.group-column', $dataCss);
        $this->assertStringContainsString('div.list-kanban .ui-sortable-placeholder', $dataCss);
        $this->assertStringContainsString('isRotten', $dataCss);

        // RTL Kanban
        $this->assertStringContainsString('html[dir="rtl"] .list-kanban-container', $rtlCss);
        $this->assertStringContainsString('overflow-x: auto', $rtlCss);
        $this->assertStringContainsString('border-right: 3px solid var(--bidar-danger', $rtlCss);

        // Dark mode Kanban
        $this->assertStringContainsString(':root[data-bidar-scheme="dark"] div.list-kanban', $darkCss);
    }

    public function testJalaliDatePickerThemeIntegration(): void
    {
        $jdpCssPath = dirname($this->extDir, 2) . '/client/custom/modules/bidar-iran/css/jalali-datepicker.css';
        $this->assertFileExists($jdpCssPath);

        $jdpCss = (string) file_get_contents($jdpCssPath);
        $this->assertStringContainsString('jdp-container', $jdpCss);
        $this->assertStringContainsString('--jdp-primary: var(--bidar-primary', $jdpCss);
        $this->assertStringContainsString(':root[data-bidar-scheme="dark"] jdp-container', $jdpCss);
    }

    public function testWhiteLabelApplierPatchesInstaller(): void
    {
        require_once dirname($this->extDir, 2) . '/scripts/apply-whitelabel.php';

        $tmpDir = sys_get_temp_dir() . '/bidar-theme-test-' . uniqid();
        mkdir($tmpDir . '/install/core/tpl', 0755, true);
        mkdir($tmpDir . '/install/core/i18n/fa_IR', 0755, true);
        mkdir($tmpDir . '/install/core/i18n/en_US', 0755, true);

        file_put_contents(
            $tmpDir . '/install/core/Installer.php',
            "<?php\nclass Installer {\n    public function getThemeList(): array {\n        return [\n            'Espo',\n            'Dark',\n        ];\n    }\n    public function save() {\n        \$data = [\n            'theme' => \$saveData['theme'] ?? 'Espo',\n        ];\n    }\n}\n"
        );

        file_put_contents(
            $tmpDir . '/install/entry.php',
            "<?php\n\$userLang = (!empty(\$_SESSION['install']['user-lang']))? \$_SESSION['install']['user-lang'] : 'en_US';\n\$smarty->assign(\"langsJs\", json_encode(\$langs));\n\$theme = \$_SESSION['install']['theme'] ?? 'Espo';\n"
        );

        file_put_contents(
            $tmpDir . '/install/core/tpl/index.tpl',
            "<!doctype html>\n<html>\n<head>\n<link href=\"css/install.css\" rel=\"stylesheet\">\n</head>\n<body></body>\n</html>\n"
        );

        file_put_contents(
            $tmpDir . '/install/core/i18n/fa_IR/install.json',
            json_encode(['labels' => ['title' => 'Install']], JSON_PRETTY_PRINT)
        );

        file_put_contents(
            $tmpDir . '/install/core/i18n/en_US/install.json',
            json_encode(['labels' => ['title' => 'Install']], JSON_PRETTY_PRINT)
        );

        $rootDir = dirname($this->extDir, 2);
        $success = \Bidar\Whitelabel\WhiteLabelApplier::patchInstallerThemes($tmpDir, $rootDir);
        $this->assertTrue($success);

        // Verify Installer.php
        $installerContent = (string) file_get_contents($tmpDir . '/install/core/Installer.php');
        $this->assertMatchesRegularExpression("/getThemeList\(\)[^{]*\{\s*return\s*\[\s*'Bidar'/s", $installerContent);
        $this->assertStringContainsString("'theme' => \$saveData['theme'] ?? 'Bidar'", $installerContent);

        // Verify entry.php
        $entryContent = (string) file_get_contents($tmpDir . '/install/entry.php');
        $this->assertStringContainsString("'fa_IR'", $entryContent);
        $this->assertStringContainsString("\$smarty->assign(\"userLang\", \$userLang);", $entryContent);
        $this->assertStringContainsString("\$theme = \$_SESSION['install']['theme'] ?? \$installer->getConfig()->get('theme') ?? 'Bidar';", $entryContent);

        // Verify index.tpl
        $indexContent = (string) file_get_contents($tmpDir . '/install/core/tpl/index.tpl');
        $this->assertStringContainsString('<html dir="rtl" lang="fa">', $indexContent);
        $this->assertStringContainsString('Vazirmatn-Variable.woff2', $indexContent);

        // Verify Bidar.json copied
        $this->assertFileExists($tmpDir . '/application/Espo/Resources/metadata/themes/Bidar.json');

        // Verify translations
        $faJson = json_decode((string) file_get_contents($tmpDir . '/install/core/i18n/fa_IR/install.json'), true);
        $this->assertSame('بیدار (پیش‌فرض RTL)', $faJson['themes']['Bidar']);

        $enJson = json_decode((string) file_get_contents($tmpDir . '/install/core/i18n/en_US/install.json'), true);
        $this->assertSame('Bidar (Default RTL)', $enJson['themes']['Bidar']);

        // Cleanup
        $this->removeDirectory($tmpDir);
    }

    public function testRtlSidebarDockingIsScopedToSideNavbar(): void
    {
        $rtlCss = (string) file_get_contents($this->clientDir . '/css/bidar-rtl.css');
        $appearanceJs = (string) file_get_contents($this->clientDir . '/js/appearance.js');

        // Side-navbar rules must be guarded for authenticated desktop side navigation.
        $this->assertStringContainsString('@media screen and (min-width: 768px)', $rtlCss);
        $this->assertStringContainsString('body[data-navbar="side"]', $rtlCss);
        $this->assertStringContainsString('.has-navbar', $rtlCss);
        $this->assertStringContainsString('body[data-navbar="side"].has-navbar > .content', $rtlCss);
        $this->assertDoesNotMatchRegularExpression('/html\[dir="rtl"\]\s*#main[^{}]*\{[^}]*margin-right\s*:/s', $rtlCss);
        $this->assertDoesNotMatchRegularExpression('/body\[data-direction="rtl"\]\s*#main[^{}]*\{[^}]*margin-right\s*:/s', $rtlCss);
        $this->assertDoesNotMatchRegularExpression('/\.navbar-right[^{}]*\{[^}]*padding-right:\s*var\(--navbar-width\)/s', $rtlCss);
        $this->assertMatchesRegularExpression('/body:not\(\.has-navbar\) > footer[^{}]*\{[^}]*margin-left:\s*0[^}]*margin-right:\s*0/s', $rtlCss);
        $this->assertStringContainsString('li.tab-group > .dropdown-menu', $rtlCss);
        $this->assertMatchesRegularExpression('/li\.tab-group > \.dropdown-menu[^{}]*\{[^}]*right:\s*var\(--navbar-width\)/s', $rtlCss);
        $this->assertMatchesRegularExpression('/li\.more > \.dropdown-menu[^{}]*\{[^}]*right:\s*var\(--navbar-width\)/s', $rtlCss);
        $this->assertStringContainsString('.bidar-record-grid > .bidar-main', $rtlCss);
        $this->assertStringContainsString('.bidar-record-grid > .bidar-content-column', $rtlCss);
        $this->assertStringNotContainsString('.bidar-record-grid > .bidar-content-card', $rtlCss);
        $this->assertStringContainsString('border-left: var(--navbar-border-width, 1px) solid var(--bidar-sidebar-line, var(--navbar-inverse-border)) !important;', $rtlCss);

        // appearance.js only defaults authenticated RTL pages to the side navbar.
        $this->assertStringContainsString("document.body.classList.contains('has-navbar')", $appearanceJs);
        $this->assertMatchesRegularExpression('/has-navbar[\s\S]{0,250}dataset\.navbar\s*=\s*[\'\"]side[\'\"]|dataset\.navbar\s*=\s*[\'\"][sS]ide[\'\"][\s\S]{0,250}has-navbar/', $appearanceJs);
        $this->assertMatchesRegularExpression('/\/\^\(fa\|ar\|he\|ur\)\(\?:\[-_\]\|\$\)\/i/', $appearanceJs);
        $this->assertStringContainsString("dir = 'rtl'", $appearanceJs);
    }

    public function testLoginPageHasDirectRtlAndCenteredLogo(): void
    {
        $loginCss = (string) file_get_contents($this->clientDir . '/css/bidar-login.css');

        // THM-LOGIN-01
        $this->assertMatchesRegularExpression('/body:has\(#login\)[^{]*\{[^}]*direction:\s*rtl/s', $loginCss);
        $this->assertMatchesRegularExpression('/#login[^{]*\{[^}]*direction:\s*rtl/s', $loginCss);
        $this->assertStringContainsString('max-height: 48px', $loginCss);
        $this->assertStringContainsString('text-align: center;', $loginCss);
        $this->assertStringContainsString('text-align: right;', $loginCss);
        $this->assertMatchesRegularExpression('/#login \.logo-container[^{}]*\{[^}]*width:\s*auto;[^}]*height:\s*auto;/s', $loginCss);
        $this->assertStringContainsString('html:not([dir="ltr"])', $loginCss);
        $this->assertMatchesRegularExpression('/html\[dir="ltr"\][^{]*\{[^}]*direction:\s*ltr;[^}]*text-align:\s*left;/s', $loginCss);
    }

    public function testLightModeSidebarTokensAndDarkModeThreeTierDepth(): void
    {
        $tokensCss = (string) file_get_contents($this->clientDir . '/css/bidar-tokens.css');
        $darkCss = (string) file_get_contents($this->clientDir . '/css/bidar-dark.css');
        $shellCss = (string) file_get_contents($this->clientDir . '/css/bidar-shell.css');

        // THM-LIGHT-01
        $this->assertStringContainsString(':root[data-bidar-scheme="light"]', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-bg: #f8fafc;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-text: #334155;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-muted: #64748b;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-line: #e2e8f0;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-hover: #f1f5f9;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-active: #e0f2fe;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-strong: #0f172a;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-glow: none;', $tokensCss);
        $this->assertStringContainsString('--bidar-sidebar-logo-filter: none;', $tokensCss);
        $this->assertStringContainsString('--bidar-topbar-bg: rgba(248, 250, 252, 0.92);', $tokensCss);
        $this->assertStringNotContainsString('--bidar-topbar-bg: #111827', $tokensCss);
        $this->assertStringNotContainsString('--bidar-topbar-bg: var(--shell-topbar)', $tokensCss);
        $this->assertStringContainsString('.global-search-button', $shellCss);
        $this->assertMatchesRegularExpression('/\.global-search-button[^{}]*\{[^}]*color:\s*var\(--bidar-text-muted\)/s', $shellCss);

        // THM-DARK-01: 3-Tier Depth
        $this->assertStringContainsString('--bidar-canvas: #090d16;', $darkCss);
        $this->assertStringContainsString('--bidar-sidebar-bg: #0f172a;', $darkCss);
        $this->assertStringContainsString('--bidar-sidebar-line: rgba(255, 255, 255, 0.08);', $darkCss);
        $this->assertStringContainsString('--bidar-surface: #1e293b;', $darkCss);
        foreach (['--bidar-text: #eceef7;', '--bidar-text-secondary: #c9cde0;', '--bidar-text-muted: #9298b5;', '--bidar-hover: #2a2e4d;', '--bidar-border: #2a2e4d;', '--bidar-border-strong: #454b6c;', '--bidar-signature: #2dd4bf;', '--bidar-n-0: #1e293b;'] as $declaration) {
            $this->assertStringContainsString($declaration, $darkCss);
        }
        $this->assertStringContainsString('var(--bidar-n-0, #1e293b)', $darkCss);
        $this->assertStringNotContainsString('var(--bidar-n-0, #161930)', $darkCss);

        foreach (['--bidar-brand-text: var(--bidar-brand)', '--bidar-brand-mark: var(--bidar-brand)', '--bidar-band-avatar-bg: var(--bidar-brand)', '--bidar-band-avatar-text: var(--bidar-on-brand)', '--bidar-band-primary-bg: var(--bidar-brand)', '--bidar-band-focus: var(--bidar-brand-ring)', '--bidar-sidebar-focus: var(--bidar-brand-ring)'] as $declaration) {
            $this->assertStringContainsString($declaration, $tokensCss);
        }

        $dataCss = (string) file_get_contents($this->clientDir . '/css/bidar-data.css');
        $overlaysCss = (string) file_get_contents($this->clientDir . '/css/bidar-overlays.css');
        foreach (['--bidar-primary', '--bidar-border-light', '--bidar-border-hover', '--bidar-text-sm'] as $undefinedToken) {
            $this->assertStringNotContainsString('var(' . $undefinedToken, $dataCss);
            $this->assertStringNotContainsString('var(' . $undefinedToken, $overlaysCss);
        }

        $mainCss = (string) file_get_contents($this->clientDir . '/css/bidar.css');
        $this->assertLessThan(strpos($mainCss, '@import "bidar-dark.css'), strpos($mainCss, '@import "bidar-rtl.css'));
        foreach (['bidar-brut.css', 'bidar-monochrome.css', 'bidar-iframe.css', 'bidar-iframe-dark.css', 'bidar-iframe-brut.css', 'bidar-iframe-brut-dark.css', 'bidar-iframe-monochrome.css', 'bidar-iframe-monochrome-dark.css'] as $cssFile) {
            $css = (string) file_get_contents($this->clientDir . '/css/' . $cssFile);
            preg_match_all('/@import[^;]*;/', $css, $imports);
            $this->assertNotEmpty($imports[0], $cssFile . ' should contain imports.');
            foreach ($imports[0] as $import) {
                $this->assertStringContainsString('?v=1.1.0', $import, $cssFile . ' has an outdated or missing import cache version.');
            }
        }

        $themeJson = json_decode((string) file_get_contents($this->extDir . '/Resources/metadata/themes/Bidar.json'), true);
        $this->assertSame('client/custom/modules/bidar-theme/img/bidar-logo-dark.svg', $themeJson['bidarDark']['logo']);
        $this->assertStringContainsString('img[src*="bidar-logo.svg"]', $darkCss);
        $this->assertStringContainsString(':not([src*="bidar-logo-dark.svg"])', $darkCss);
    }

    public function testBadgesHaveNoWrapInDataCss(): void
    {
        $dataCss = (string) file_get_contents($this->clientDir . '/css/bidar-data.css');

        // THM-BADGE-01
        $this->assertStringContainsString('.bidar-badge', $dataCss);
        $this->assertStringNotContainsString('[class*="badge"]', $dataCss);
        foreach (['.badge', '.label', '.bidar-badge', '.number-badge', 'td[data-name="status"] > .field > span', 'td[data-name="stage"] > .field > span'] as $selector) {
            $this->assertStringContainsString($selector, $dataCss);
        }
        $this->assertMatchesRegularExpression('/\.badge\s*,\s*\.label\s*,\s*\.bidar-badge\s*,\s*\.number-badge\s*,\s*td\[data-name="status"\]\s*>\s*\.field\s*>\s*span\s*,\s*td\[data-name="stage"\]\s*>\s*\.field\s*>\s*span\s*\{[^}]*white-space:\s*nowrap !important;/s', $dataCss);
        $this->assertStringContainsString('display: inline-flex;', $dataCss);
    }

    public function testRtlDetailRulesMirrorDirectionalLayout(): void
    {
        $detailCss = (string) file_get_contents($this->clientDir . '/css/bidar-detail.css');
        $rtlCss = (string) file_get_contents($this->clientDir . '/css/bidar-rtl.css');

        $this->assertStringContainsString('clip-path:', $detailCss);
        $this->assertStringContainsString('polygon(12px 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 12px 100%, 0 50%)', $rtlCss);
        $this->assertMatchesRegularExpression('/\.stream-date-container[^{}]*\{[^}]*text-align:\s*end/s', $rtlCss);
        $this->assertMatchesRegularExpression('/@media\s*\(min-width:\s*768px\)[\s\S]*?\.modal:not\(\.dialog-confirm\):not\(\.dialog-centered\) > \.modal-dialog[^{}]*\{[^}]*margin:\s*0 auto 0 0;/s', $rtlCss);
    }

    public function testAfterInstallPersistsConfigAndHasNoUnusedEntityManagerImport(): void
    {
        $source = (string) file_get_contents($this->extDir . '/scripts/AfterInstall.php');
        $this->assertStringContainsString('$configWriter->save()', $source);
        $this->assertStringNotContainsString('use Espo\\ORM\\EntityManager;', $source);
    }

    public function testPreferenceTranslationsExistForBothLocales(): void
    {
        foreach (['fa_IR', 'en_US'] as $locale) {
            $path = $this->extDir . '/Resources/i18n/' . $locale . '/Preferences.json';
            $this->assertFileExists($path);
            $translations = json_decode((string) file_get_contents($path), true);
            $this->assertIsArray($translations);
            foreach (['bidarColorScheme', 'bidarDensity', 'bidarLayout'] as $key) {
                $this->assertArrayHasKey($key, $translations['labels'] ?? [], $locale . ' is missing label ' . $key);
            }
        }
    }

    public function testBrandCurrencyAdminIconUsesCoins(): void
    {
        $path = dirname($this->extDir) . '/bidar-brand/Resources/metadata/app/adminPanel.json';
        $metadata = json_decode((string) file_get_contents($path), true);
        $this->assertIsArray($metadata);
        $this->assertStringContainsString('fas fa-coins', json_encode($metadata));
        $this->assertStringNotContainsString('fas fa-euro-sign', json_encode($metadata));
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }
}
