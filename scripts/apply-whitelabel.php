<?php
/**
 * BidarCRM - Automated White-Labeling Script
 *
 * Applies white-label branding from config/brand.config.json to target build or engine.
 * Idempotent: can be executed repeatedly without side effects.
 *
 * Usage:
 *   php scripts/apply-whitelabel.php --target=/path/to/build [--brand=config/brand.config.json]
 */

declare(strict_types=1);

namespace Bidar\Whitelabel;

class WhiteLabelApplier
{
    private array $brand;
    private string $targetDir;
    private string $rootDir;

    private static function readFile(string $path): string
    {
        $content = @file_get_contents($path);
        if ($content === false) {
            throw new \RuntimeException("Unable to read file: {$path}");
        }
        return $content;
    }

    private static function writeFile(string $path, string $content): void
    {
        if (is_file($path) && self::readFile($path) === $content) {
            return;
        }
        if (@file_put_contents($path, $content) === false) {
            throw new \RuntimeException("Unable to write file: {$path}");
        }
    }

    private static function copyFile(string $source, string $target): void
    {
        if (is_file($target) && self::readFile($target) === self::readFile($source)) {
            return;
        }
        if (!@copy($source, $target)) {
            throw new \RuntimeException("Unable to copy {$source} to {$target}");
        }
    }

    private static function ensureDirectory(string $path): void
    {
        if (!is_dir($path) && !@mkdir($path, 0755, true) && !is_dir($path)) {
            throw new \RuntimeException("Unable to create directory: {$path}");
        }
    }

    private static function encodeJson(array $data, string $path): string
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException("Unable to encode JSON for {$path}: " . json_last_error_msg());
        }
        return $json . "\n";
    }

    private function escapeHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function stripHtmlDirectionAttributes(string $attributes): string
    {
        preg_match_all(
            '~([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+))?~',
            $attributes,
            $matches,
            PREG_SET_ORDER
        );

        $kept = [];
        foreach ($matches as $match) {
            if (!in_array(strtolower($match[1]), ['dir', 'lang'], true)) {
                $kept[] = $match[0];
            }
        }

        return $kept === [] ? '' : ' ' . implode(' ', $kept);
    }

    private function validatedUrl(string $url): string
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true) || empty(parse_url($url, PHP_URL_HOST))) {
            throw new \RuntimeException('Brand URLs must be valid http or https URLs.');
        }
        return $url;
    }

    public function __construct(string $targetDir, array $brand, ?string $rootDir = null)
    {
        $this->targetDir = rtrim($targetDir, '/\\');
        $this->brand = $brand;
        $this->rootDir = $rootDir ? rtrim($rootDir, '/\\') : dirname(__DIR__);
    }

    public static function fromConfigFiles(string $targetDir, string $brandConfigPath, ?string $rootDir = null): self
    {
        if (!is_dir($targetDir)) {
            throw new \InvalidArgumentException("Target directory does not exist: {$targetDir}");
        }

        if (!file_exists($brandConfigPath)) {
            throw new \InvalidArgumentException("Brand configuration not found: {$brandConfigPath}");
        }

        $content = self::readFile($brandConfigPath);
        $brand = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($brand) || empty($brand['name'])) {
            throw new \InvalidArgumentException("Invalid brand configuration JSON in {$brandConfigPath}");
        }

        return new self($targetDir, $brand, $rootDir);
    }

    public function apply(): array
    {
        $changes = [];

        $changes['mainHtml'] = $this->patchMainHtml();
        $changes['siteFooter'] = $this->patchSiteFooter();
        $changes['aboutTemplate'] = $this->patchAboutTemplate();
        $changes['installerTpl'] = $this->patchInstallerTemplates();
        $changes['installerI18n'] = $this->patchInstallerI18n();
        $changes['installerThemes'] = self::patchInstallerThemes($this->targetDir, $this->rootDir, $this->brand);
        $changes['installerDemoDataSeeder'] = self::patchInstallerDemoDataSeeder($this->targetDir, $this->rootDir);
        $changes['assets'] = $this->copyBrandAssets();
        $changes['defaultConfig'] = $this->patchDefaultsConfig();
        $changes['notice'] = $this->generateNoticeFile();

        return $changes;
    }

    public function patchMainHtml(): bool
    {
        $path = $this->targetDir . '/html/main.html';
        if (!file_exists($path)) {
            return false;
        }

        $content = self::readFile($path);
        $nameFa = $this->brand['nameFa'] ?? 'بیدار CRM';
        $websiteUrl = $this->validatedUrl((string) ($this->brand['websiteUrl'] ?? 'https://bidarcrm.ir'));
        $websiteUrlHtml = $this->escapeHtml($websiteUrl);
        $taglineFa = $this->brand['taglineFa'] ?? 'سامانه هوشمند مدیریت فروش و ارتباط با مشتری';
        $copyrightFa = $this->brand['copyrightFa'] ?? 'تمامی حقوق محفوظ است © ۱۴۰۵ بیدار CRM';

        // Replace footer copyright and link
        $replacement = "<p class=\"credit small\">{$this->escapeHtml((string) $copyrightFa)} <a href=\"{$websiteUrlHtml}\" title=\"{$this->escapeHtml((string) $taglineFa)}\" rel=\"noopener\" target=\"_blank\">{$this->escapeHtml((string) $nameFa)}</a></p>";

        // Match original Espo footer or previously patched footer
        $pattern = '/<p class="credit small">.*?<\/p>/s';
        if (preg_match($pattern, $content)) {
            $newContent = preg_replace_callback($pattern, static fn() => $replacement, $content, 1);
            self::writeFile($path, $newContent);
            return true;
        }

        return false;
    }

    public function patchSiteFooter(): bool
    {
        $path = $this->targetDir . '/client/res/templates/site/footer.tpl';
        if (!file_exists($path)) {
            return false;
        }

        $nameFa = $this->brand['nameFa'] ?? 'بیدار CRM';
        $websiteUrl = $this->validatedUrl((string) ($this->brand['websiteUrl'] ?? 'https://bidarcrm.ir'));
        $taglineFa = $this->brand['taglineFa'] ?? 'سامانه هوشمند مدیریت فروش و ارتباط با مشتری';
        $copyrightFa = $this->brand['copyrightFa'] ?? 'تمامی حقوق محفوظ است © ۱۴۰۵ بیدار CRM';

        $replacement = "<p class=\"credit small\">{$this->escapeHtml((string) $copyrightFa)}\n<a\n    href=\"{$this->escapeHtml($this->validatedUrl((string) $websiteUrl))}\"\n    title=\"{$this->escapeHtml((string) $taglineFa)}\"\n    rel=\"noopener\" target=\"_blank\"\n    tabindex=\"-1\"\n>{$this->escapeHtml((string) $nameFa)}</a></p>\n";

        self::writeFile($path, $replacement);
        return true;
    }

    public function patchAboutTemplate(): bool
    {
        $path = $this->targetDir . '/client/res/templates/about.tpl';
        if (!file_exists($path)) {
            return false;
        }

        $name = $this->brand['name'] ?? 'Bidar CRM';
        $nameFa = $this->brand['nameFa'] ?? 'بیدار CRM';
        $websiteUrl = $this->validatedUrl((string) ($this->brand['websiteUrl'] ?? 'https://bidarcrm.ir'));
        $taglineFa = $this->brand['taglineFa'] ?? 'سامانه هوشمند مدیریت فروش و ارتباط با مشتری';
        $copyrightFa = $this->brand['copyrightFa'] ?? 'تمامی حقوق محفوظ است © ۱۴۰۵ بیدار CRM';

        $nameFaHtml = $this->escapeHtml((string) $nameFa);
        $nameHtml = $this->escapeHtml((string) $name);
        $websiteUrlHtml = $this->escapeHtml($websiteUrl);
        $taglineFaHtml = $this->escapeHtml((string) $taglineFa);
        $copyrightFaHtml = $this->escapeHtml((string) $copyrightFa);
        $tpl = <<<HTML
<div class="page-header">
    <h3>{{translate 'About'}}</h3>
</div>

<div class="row">
    <div class="col-md-8">
        <div class="panel panel-default">
            <div class="panel-body">
                <h4>{$nameFaHtml} ({$nameHtml})</h4>
                <p>
                    <span class="text-bold text-soft">Version {{version}}</span>
                </p>
                <p class="text-soft">{$taglineFaHtml}</p>
                <p class="credit small">{$copyrightFaHtml}</p>
                <p><a href="{$websiteUrlHtml}" target="_blank" rel="noopener">{$websiteUrlHtml}</a></p>
            </div>
        </div>
    </div>
</div>
HTML;

        self::writeFile($path, $tpl);
        return true;
    }

    public function patchInstallerTemplates(): bool
    {
        $updated = false;
        $name = $this->brand['name'] ?? 'Bidar CRM';
        $nameFa = $this->brand['nameFa'] ?? 'بیدار CRM';
        $websiteUrl = $this->validatedUrl((string) ($this->brand['websiteUrl'] ?? 'https://bidarcrm.ir'));
        $supportUrl = $this->validatedUrl((string) ($this->brand['supportUrl'] ?? 'https://bidarcrm.ir/support'));
        $copyrightFa = $this->brand['copyrightFa'] ?? 'تمامی حقوق محفوظ است © ۱۴۰۵ بیدار CRM';

        // 1. install/core/tpl/footer.tpl
        $footerPath = $this->targetDir . '/install/core/tpl/footer.tpl';
        if (file_exists($footerPath)) {
            $footerContent = "<p class=\"credit small\">{$this->escapeHtml((string) $copyrightFa)} <a href=\"{$this->escapeHtml($this->validatedUrl((string) $websiteUrl))}\" target=\"_blank\" rel=\"noopener\">{$this->escapeHtml((string) $nameFa)}</a></p>\n";
            self::writeFile($footerPath, $footerContent);
            $updated = true;
        }

        // 2. install/core/tpl/main.tpl
        $mainPath = $this->targetDir . '/install/core/tpl/main.tpl';
        if (file_exists($mainPath)) {
            $mainContent = self::readFile($mainPath);
            // Replace alt="EspoCRM" with brand name
            $mainContent = preg_replace_callback('/alt="EspoCRM"/i', fn() => 'alt="' . $this->escapeHtml((string) $name) . '"', $mainContent);
            // Replace external doc link with brand support url
            $mainContent = str_replace(
                'https://www.espocrm.com/documentation/administration/installation/',
                $this->escapeHtml($supportUrl),
                $mainContent
            );
            self::writeFile($mainPath, $mainContent);
            $updated = true;
        }

        // 3. install/core/tpl/finish.tpl
        $finishPath = $this->targetDir . '/install/core/tpl/finish.tpl';
        if (file_exists($finishPath)) {
            $finishContent = self::readFile($finishPath);
            $finishContent = str_replace(
                'https://www.espocrm.com/documentation/administration/server-configuration/#user-content-setup-a-crontab',
                $this->escapeHtml($supportUrl),
                $finishContent
            );
            self::writeFile($finishPath, $finishContent);
            $updated = true;
        }

        // 4. install/core/tpl/index.tpl
        $indexPath = $this->targetDir . '/install/core/tpl/index.tpl';
        if (file_exists($indexPath)) {
            $indexContent = self::readFile($indexPath);
            // Ensure favicon is updated to svg or ico
            if (strpos($indexContent, 'favicon.svg') === false && strpos($indexContent, 'favicon.ico') !== false) {
                $indexContent = str_replace(
                    '<link rel="shortcut icon" href="../client/img/favicon.ico" type="image/x-icon">',
                    '<link rel="icon" href="../client/img/favicon.svg" type="image/svg+xml">' . "\n" .
                    '        <link rel="shortcut icon" href="../client/img/favicon.ico" type="image/x-icon">',
                    $indexContent
                );
            }
            self::writeFile($indexPath, $indexContent);
            $updated = true;
        }

        return $updated;
    }

    public function patchInstallerI18n(): bool
    {
        $updated = false;
        $name = $this->brand['name'] ?? 'Bidar CRM';
        $nameFa = $this->brand['nameFa'] ?? 'بیدار CRM';
        $shortName = $this->brand['shortName'] ?? $nameFa;
        $themeNameEn = $this->brand['themeNameEn'] ?? ($name === 'Bidar CRM' ? 'Bidar' : $name);
        $websiteUrl = $this->validatedUrl((string) ($this->brand['websiteUrl'] ?? 'https://bidarcrm.ir'));
        $supportUrl = $this->validatedUrl((string) ($this->brand['supportUrl'] ?? 'https://bidarcrm.ir/support'));

        // 1. fa_IR/install.json
        $faPath = $this->targetDir . '/install/core/i18n/fa_IR/install.json';
        if (file_exists($faPath)) {
            $data = json_decode(self::readFile($faPath), true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
                throw new \RuntimeException('Malformed installer JSON: ' . $faPath);
            }
            if (is_array($data)) {
                $data['labels']['headerTitle'] = "نصب {$nameFa}";
                $data['labels']['Main page title'] = "به {$nameFa} خوش آمدید";
                $data['labels']['Congratulation! Welcome to EspoCRM'] = "تبریک! {$nameFa} با موفقیت نصب شد.";
                $data['labels']['Go to EspoCRM'] = "ورود به {$nameFa}";

                // Recursively replace EspoCRM in strings
                $data = $this->replaceBrandStrings($data, [
                    'EspoCRM' => $nameFa,
                    'https://www.espocrm.com' => $websiteUrl,
                    'espocrm.com' => parse_url($websiteUrl, PHP_URL_HOST) ?? 'bidarcrm.ir',
                ]);

                if (!isset($data['themes']) || !is_array($data['themes'])) {
                    $data['themes'] = [];
                }
                $data['themes']['Bidar'] = "{$shortName} (پیش‌فرض RTL)";

                self::writeFile($faPath, self::encodeJson($data, $faPath));
                $updated = true;
            }
        }

        // 2. en_US/install.json
        $enPath = $this->targetDir . '/install/core/i18n/en_US/install.json';
        if (file_exists($enPath)) {
            $data = json_decode(self::readFile($enPath), true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
                throw new \RuntimeException('Malformed installer JSON: ' . $enPath);
            }
            if (is_array($data)) {
                $data['labels']['headerTitle'] = "{$name} Installation";
                $data['labels']['Main page title'] = "Welcome to {$name}";
                $data['labels']['Congratulation! Welcome to EspoCRM'] = "Congratulations! {$name} has been successfully installed.";
                $data['labels']['Go to EspoCRM'] = "Go to {$name}";

                // Recursively replace EspoCRM in strings
                $data = $this->replaceBrandStrings($data, [
                    'EspoCRM' => $name,
                    'https://www.espocrm.com' => $websiteUrl,
                    'espocrm.com' => parse_url($websiteUrl, PHP_URL_HOST) ?? 'bidarcrm.ir',
                ]);

                if (!isset($data['themes']) || !is_array($data['themes'])) {
                    $data['themes'] = [];
                }
                $data['themes']['Bidar'] = "{$themeNameEn} (Default RTL)";

                self::writeFile($enPath, self::encodeJson($data, $enPath));
                $updated = true;
            }
        }

        return $updated;
    }

    public static function patchInstallerThemes(string $targetDir, ?string $rootDir = null, ?array $brand = null): bool
    {
        $rootDir = $rootDir ? rtrim($rootDir, '/\\') : dirname(__DIR__);
        $targetDir = rtrim($targetDir, '/\\');
        $shortName = $brand['shortName'] ?? ($brand['nameFa'] ?? 'بیدار');
        $themeNameEn = $brand['themeNameEn'] ?? ((($brand['name'] ?? 'Bidar CRM') === 'Bidar CRM') ? 'Bidar' : (string) $brand['name']);
        $updated = false;

        // 1. Patch $targetDir/install/core/Installer.php
        $installerPath = $targetDir . '/install/core/Installer.php';
        if (file_exists($installerPath)) {
            $content = self::readFile($installerPath);

            // In getThemeList(): ensure 'Bidar' is prepended as first item
            if (!preg_match("/getThemeList\(\)[^{]*\{\s*return\s*\[\s*'Bidar'/s", $content)) {
                $content = preg_replace_callback(
                    "/(public\s+function\s+getThemeList\(\)[^{]*\{\s*return\s*\[\s*)/s",
                    static fn(array $match): string => $match[1] . "'Bidar',\n            ",
                    $content,
                    1
                );
            }

            // In saving default config: change default theme from 'Espo' to 'Bidar'
            $content = preg_replace_callback(
                "/('theme'\s*=>\s*\\\$saveData\['theme'\]\s*\?\?\s*)'Espo'/s",
                static fn(array $match): string => $match[1] . "'Bidar'",
                $content,
                1
            );

            self::writeFile($installerPath, $content);
            $updated = true;
        }

        // 2. Patch $targetDir/install/entry.php
        $entryPath = $targetDir . '/install/entry.php';
        if (file_exists($entryPath)) {
            $content = self::readFile($entryPath);

            // Line ~77: change default language fallback to 'fa_IR'
            $content = preg_replace_callback(
                "/(\\\$userLang\s*=\s*\(!empty\(\\\$_SESSION\['install'\]\['user-lang'\]\)\)\s*\?\s*\\\$[\w\[\]\-\'\"]+\s*:\s*)'en_US';/",
                static fn(array $match): string => $match[1] . "'fa_IR';",
                $content,
                1
            );

            // Ensure $userLang is assigned to Smarty
            if (strpos($content, '$smarty->assign("userLang"') === false && strpos($content, '$smarty->assign(\'userLang\'') === false) {
                $content = str_replace(
                    '$smarty->assign("langsJs", json_encode($langs));',
                    '$smarty->assign("langsJs", json_encode($langs));' . "\n" . '$smarty->assign("userLang", $userLang);',
                    $content
                );
            }

            // Line ~198: change default theme fallback
            $content = preg_replace_callback(
                "/\\\$theme\s*=\s*\\\$_SESSION\['install'\]\['theme'\]\s*\?\?\s*'Espo';/",
                static fn(): string => '$theme = $_SESSION[\'install\'][\'theme\'] ?? $installer->getConfig()->get(\'theme\') ?? \'Bidar\';',
                $content,
                1
            );

            self::writeFile($entryPath, $content);
            $updated = true;
        }

        // 3. Patch $targetDir/install/core/tpl/index.tpl
        $indexPath = $targetDir . '/install/core/tpl/index.tpl';
        if (file_exists($indexPath)) {
            $content = self::readFile($indexPath);

            // If user language is RTL, render <html dir="rtl" lang="fa"> without duplicating existing attributes.
            if (strpos($content, 'dir="rtl"') === false) {
                $content = preg_replace_callback(
                    '/<html\b([^>]*)>/i',
                    static function (array $match): string {
                        $attributes = $match[1];
                        $rtlAttributes = self::stripHtmlDirectionAttributes($attributes);

                        return "{if \$userLang == 'fa_IR' || \$userLang == 'ar_AR'}<html dir=\"rtl\" lang=\"fa\"{$rtlAttributes}>{else}<html{$attributes}>{/if}";
                    },
                    $content,
                    1
                );
            }

            // Ensure local font Vazirmatn-Variable.woff2 is referenced for installer in RTL mode
            if (strpos($content, 'Vazirmatn') === false) {
                $fontSnippet = "\n        {if \$userLang == 'fa_IR' || \$userLang == 'ar_AR'}\n" .
                    "        <style>\n" .
                    "            @font-face {\n" .
                    "                font-family: 'Vazirmatn';\n" .
                    "                src: url('../client/custom/modules/bidar-theme/fonts/vazirmatn/Vazirmatn-Variable.woff2') format('woff2');\n" .
                    "                font-weight: 100 900;\n" .
                    "                font-style: normal;\n" .
                    "                font-display: swap;\n" .
                    "            }\n" .
                    "            body, .install-body, input, select, textarea, button, .panel-title, h1, h2, h3, h4, h5, h6 {\n" .
                    "                font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;\n" .
                    "            }\n" .
                    "        </style>\n" .
                    "        {/if}";
                $content = str_replace(
                    '<link href="css/install.css" rel="stylesheet">',
                    '<link href="css/install.css" rel="stylesheet">' . $fontSnippet,
                    $content
                );
            }

            self::writeFile($indexPath, $content);
            $updated = true;
        }

        // 4. Copy extensions/bidar-theme/Resources/metadata/themes/Bidar.json to $targetDir/application/Espo/Resources/metadata/themes/Bidar.json
        $srcBidarJson = $rootDir . '/extensions/bidar-theme/Resources/metadata/themes/Bidar.json';
        $destBidarJson = $targetDir . '/application/Espo/Resources/metadata/themes/Bidar.json';
        if (file_exists($srcBidarJson)) {
            $destDir = dirname($destBidarJson);
            if (!is_dir($destDir)) {
                self::ensureDirectory($destDir);
            }
            self::copyFile($srcBidarJson, $destBidarJson);
            $updated = true;
        }

        // 5. Add "Bidar" under "themes" in install/core/i18n/fa_IR/install.json and en_US/install.json
        $faJsonPath = $targetDir . '/install/core/i18n/fa_IR/install.json';
        if (file_exists($faJsonPath)) {
            $faData = json_decode(self::readFile($faJsonPath), true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($faData)) {
                throw new \RuntimeException('Malformed installer JSON: ' . $faJsonPath);
            }
            if (!isset($faData['themes']) || !is_array($faData['themes'])) {
                $faData['themes'] = [];
            }
            $faData['themes']['Bidar'] = "{$shortName} (پیش‌فرض RTL)";
            self::writeFile($faJsonPath, self::encodeJson($faData, $faJsonPath));
            $updated = true;
        }

        $enJsonPath = $targetDir . '/install/core/i18n/en_US/install.json';
        if (file_exists($enJsonPath)) {
            $enData = json_decode(self::readFile($enJsonPath), true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($enData)) {
                throw new \RuntimeException('Malformed installer JSON: ' . $enJsonPath);
            }
            if (!isset($enData['themes']) || !is_array($enData['themes'])) {
                $enData['themes'] = [];
            }
            $enData['themes']['Bidar'] = "{$themeNameEn} (Default RTL)";
            self::writeFile($enJsonPath, self::encodeJson($enData, $enJsonPath));
            $updated = true;
        }

        return $updated;
    }

    public static function patchInstallerDemoDataSeeder(string $targetDir, ?string $rootDir = null): bool
    {
        $rootDir = $rootDir ? rtrim($rootDir, '/\\') : dirname(__DIR__);
        $targetDir = rtrim($targetDir, '/\\');
        $updated = false;

        // 1. Patch $targetDir/install/core/tpl/step4.tpl
        $step4Path = $targetDir . '/install/core/tpl/step4.tpl';
        if (file_exists($step4Path)) {
            $content = self::readFile($step4Path);
            if (strpos($content, 'name="importDemoData"') !== false) {
                $updated = true;
            } else {
                $checkboxHtml = "\n" .
                    '                <div class="row">' . "\n" .
                    '                    <div class="cell col-sm-12 form-group" style="margin-top: 15px;">' . "\n" .
                    '                        <label style="font-weight: 500; cursor: pointer;">' . "\n" .
                    '                            <input type="checkbox" name="importDemoData" value="1" class="main-element form-checkbox" checked style="margin-inline-end: 8px; vertical-align: middle;">' . "\n" .
                    '                            <span>{if $userLang == \'fa_IR\'}وارد کردن داده‌های نمونه / دمو (کاریز فروش، مشتریان، معاملات، فعالیت‌ها و محصولات نمونه){else}Import sample / demo data (Sales pipeline, accounts, contacts, deals, activities & products){/if}</span>' . "\n" .
                    '                        </label>' . "\n" .
                    '                    </div>' . "\n" .
                    '                </div>' . "\n";

                // Insert before </form>
                if (strpos($content, '</form>') !== false) {
                    $content = str_replace('</form>', $checkboxHtml . '    </form>', $content);
                    self::writeFile($step4Path, $content);
                    $updated = true;
                }
            }
        }

        // 2. Patch $targetDir/public/install/js/install.js
        $installJsPath = $targetDir . '/public/install/js/install.js';
        if (file_exists($installJsPath)) {
            $content = self::readFile($installJsPath);

            // In setSystemSett(): capture importDemoData
            if (strpos($content, 'this.systemSettings.importDemoData') !== false) {
                $updated = true;
            } else {
                $patchedContent = str_replace(
                    "this.systemSettings.language = $('[name=\"language\"]').val();",
                    "this.systemSettings.language = $('[name=\"language\"]').val();\n\tthis.systemSettings.importDemoData = $('[name=\"importDemoData\"]').is(':checked') ? '1' : '0';",
                    $content
                );
                if ($patchedContent !== $content) {
                    $content = $patchedContent;
                    $updated = true;
                }
            }

            // In step4(): trigger seedDemoData if checked
            if (strpos($content, "'seedDemoData'") === false) {
                $targetCode = ".done(ajaxData => {\n\t\t\tif (typeof(ajaxData) != 'undefined' && ajaxData.success) {\n\t\t\t\tself.goTo(nextAction);\n\t\t\t}\n\t\t});";
                $replacementCode = ".done(ajaxData => {\n\t\t\tif (typeof(ajaxData) != 'undefined' && ajaxData.success) {\n\t\t\t\tif (self.systemSettings && self.systemSettings.importDemoData === '1') {\n\t\t\t\t\tself.showLoading();\n\t\t\t\t\t$.ajax({\n\t\t\t\t\t\turl: \"index.php\",\n\t\t\t\t\t\ttype: \"POST\",\n\t\t\t\t\t\tdata: { action: 'seedDemoData' },\n\t\t\t\t\t\tdataType: 'json',\n\t\t\t\t\t})\n\t\t\t\t\t.always(() => {\n\t\t\t\t\t\tself.goTo(nextAction);\n\t\t\t\t\t});\n\t\t\t\t} else {\n\t\t\t\t\tself.goTo(nextAction);\n\t\t\t\t}\n\t\t\t}\n\t\t});";

                if (strpos($content, $targetCode) !== false) {
                    $content = str_replace($targetCode, $replacementCode, $content);
                    $updated = true;
                } else {
                    $normalizedContent = str_replace("\r\n", "\n", $content);
                    if (strpos($normalizedContent, $targetCode) !== false) {
                        $content = str_replace($targetCode, $replacementCode, $normalizedContent);
                        $updated = true;
                    }
                }
            } else {
                $updated = true;
            }

            self::writeFile($installJsPath, $content);
        }

        // 3. Patch $targetDir/install/core/Utils.php
        $utilsPath = $targetDir . '/install/core/Utils.php';
        if (file_exists($utilsPath)) {
            $content = self::readFile($utilsPath);
            if (strpos($content, "'seedDemoData'") !== false) {
                $updated = true;
            } else {
                $patchedContent = preg_replace_callback(
                    "/('step5'\s*,)/",
                    static fn(array $match): string => $match[1] . "\n            'seedDemoData',",
                    $content,
                    1
                );
                if ($patchedContent !== $content) {
                    self::writeFile($utilsPath, $patchedContent);
                    $updated = true;
                }
            }
        }

        // 4. Patch $targetDir/install/core/Installer.php (expose getApplication)
        $installerPath = $targetDir . '/install/core/Installer.php';
        if (file_exists($installerPath)) {
            $content = self::readFile($installerPath);
            if (strpos($content, 'function getApplication') !== false) {
                $updated = true;
            } else {
                $patchedContent = str_replace(
                    'private function getContainer(): Container',
                    "public function getApplication(): ?Application\n    {\n        return \$this->app;\n    }\n\n    private function getContainer(): Container",
                    $content
                );
                if ($patchedContent !== $content) {
                    self::writeFile($installerPath, $patchedContent);
                    $updated = true;
                }
            }
        }

        // 5. Create $targetDir/install/core/actions/seedDemoData.php
        $actionDir = $targetDir . '/install/core/actions';
        if (is_dir($actionDir)) {
            $actionFile = $actionDir . '/seedDemoData.php';
            $actionContent = <<<PHP
<?php
/************************************************************************
 * BidarCRM - Demo Data Seeder Installer Action
 ************************************************************************/

declare(strict_types=1);

ob_start();
\$result = [
    'status' => 0,
    'success' => false,
    'errorMsg' => '',
    'summary' => [],
];

try {
    \$app = null;
    if (isset(\$installer) && method_exists(\$installer, 'getApplication')) {
        \$app = \$installer->getApplication();
    }
    if (!\$app) {
        \$app = new \Espo\Core\Application();
    }

    \$container = \$app->getContainer();
    \$container->get('applicationUser')->setupSystemUser();
    \$em = \$container->get('entityManager');

    \$adminUserId = null;
    \$userRepo = \$em->getRepository('User');
    if (!empty(\$_SESSION['install']['user-name'])) {
        \$user = \$userRepo->where(['userName' => \$_SESSION['install']['user-name']])->findOne();
        if (\$user) {
            \$adminUserId = \$user->getId();
        }
    }
    if (!\$adminUserId) {
        \$adminUser = \$userRepo->where(['isAdmin' => true, 'deleted' => false])->findOne();
        if (\$adminUser) {
            \$adminUserId = \$adminUser->getId();
        }
    }

    if (!class_exists(\Espo\Modules\BidarSales\Seed\DemoDataSeeder::class)) {
        throw new \\RuntimeException('Demo data seeder is not available.');
    }
    \$seeder = new \Espo\Modules\BidarSales\Seed\DemoDataSeeder(\$em);
    \$summary = \$seeder->seed(\$adminUserId);

    \$result['status'] = 1;
    \$result['success'] = true;
    \$result['summary'] = \$summary;
} catch (\Throwable \$e) {
    \$result['status'] = 0;
    \$result['success'] = false;
    \$result['errorMsg'] = \$e->getMessage();
}

while (ob_get_level() > 0) {
    ob_end_clean();
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode(\$result);
exit;

PHP;
            self::writeFile($actionFile, $actionContent);
            $updated = true;
        }

        return $updated;
    }

    private function replaceBrandStrings(mixed $value, array $replacements): mixed
    {
        if (is_array($value)) {
            foreach ($value as $k => $v) {
                $value[$k] = $this->replaceBrandStrings($v, $replacements);
            }
            return $value;
        }

        if (is_string($value)) {
            foreach ($replacements as $search => $replace) {
                $value = str_replace($search, $replace, $value);
            }
            return $value;
        }

        return $value;
    }

    public function copyBrandAssets(): bool
    {
        $targetImgDir = $this->targetDir . '/client/img';
        if (!is_dir($targetImgDir)) {
            self::ensureDirectory($targetImgDir);
        }

        $assets = $this->brand['assets'] ?? [];
        $logoLightSrc = $this->resolveAssetPath($assets['logoLight'] ?? 'assets/brand/bidar-logo.svg');
        $logoDarkSrc = $this->resolveAssetPath($assets['logoDark'] ?? 'assets/brand/bidar-logo-dark.svg');
        $faviconSvgSrc = $this->resolveAssetPath($assets['faviconSvg'] ?? 'assets/brand/bidar-favicon.svg');

        $copied = false;

        if (file_exists($logoLightSrc)) {
            self::copyFile($logoLightSrc, $targetImgDir . '/logo.svg');
            self::copyFile($logoLightSrc, $targetImgDir . '/logo-light.svg');
            self::copyFile($logoLightSrc, $targetImgDir . '/logo-lite.svg');
            $copied = true;
        }

        if (file_exists($logoDarkSrc)) {
            self::copyFile($logoDarkSrc, $targetImgDir . '/logo-dark.svg');
            $copied = true;
        }

        if (file_exists($faviconSvgSrc)) {
            self::copyFile($faviconSvgSrc, $targetImgDir . '/favicon.svg');
            $copied = true;
        }

        $faviconIcoSrc = isset($assets['faviconIco']) ? $this->resolveAssetPath((string) $assets['faviconIco']) : null;
        if ($faviconIcoSrc !== null && is_file($faviconIcoSrc)) {
            self::copyFile($faviconIcoSrc, $targetImgDir . '/favicon.ico');
            $copied = true;
        }

        // Also copy to public/install/img if present
        $publicInstallImg = $this->targetDir . '/public/install/img';
        if (is_dir($publicInstallImg) && file_exists($logoLightSrc)) {
            self::copyFile($logoLightSrc, $publicInstallImg . '/logo.svg');
        }

        return $copied;
    }

    private function resolveAssetPath(string $relativePath): string
    {
        if ($relativePath !== '' && ($relativePath[0] === '/' || $relativePath[0] === '\\')) {
            return $relativePath;
        }
        return $this->rootDir . '/' . ltrim($relativePath, '/\\');
    }

    public function patchDefaultsConfig(): bool
    {
        $path = $this->targetDir . '/application/Espo/Resources/defaults/config.php';
        if (!file_exists($path)) {
            return false;
        }

        $content = self::readFile($path);

        $nameFa = $this->brand['nameFa'] ?? 'بیدار CRM';
        $outboundEmailFromName = $this->brand['outboundEmailFromName'] ?? $nameFa;
        $defaultTab = $this->brand['defaultDashboardTabName'] ?? 'نشانگر من';

        // 1. Replace or insert applicationName
        $content = $this->replaceOrInsertConfigParam($content, 'applicationName', $nameFa);

        // 2. Replace or insert outboundEmailFromName
        $content = $this->replaceOrInsertConfigParam($content, 'outboundEmailFromName', $outboundEmailFromName);

        // 3. Theme
        $content = $this->replaceOrInsertConfigParam($content, 'theme', 'Bidar');

        // 4. Language & Regional settings
        $content = $this->replaceOrInsertConfigParam($content, 'language', 'fa_IR');
        $content = $this->replaceOrInsertConfigParam($content, 'timeZone', 'Asia/Tehran');
        $content = $this->replaceOrInsertConfigParam($content, 'weekStart', 6);
        $content = $this->replaceOrInsertConfigParam($content, 'dateFormat', 'YYYY/MM/DD');
        $content = $this->replaceOrInsertConfigParam($content, 'timeFormat', 'HH:mm');
        $content = $this->replaceOrInsertConfigParam($content, 'thousandSeparator', ',');
        $content = $this->replaceOrInsertConfigParam($content, 'decimalMark', '.');
        $content = $this->replaceOrInsertConfigParam($content, 'currencyList', ['IRT', 'IRR']);
        $content = $this->replaceOrInsertConfigParam($content, 'defaultCurrency', 'IRT');
        $content = $this->replaceOrInsertConfigParam($content, 'baseCurrency', 'IRT');
        $content = $this->replaceOrInsertConfigParam($content, 'currencyFormat', 2);
        $content = $this->replaceOrInsertConfigParam($content, 'currencyDecimalPlaces', 0);
        $content = $this->replaceOrInsertConfigParam($content, 'phoneNumberPreferredCountryList', ['ir']);
        $content = $this->replaceOrInsertConfigParam($content, 'phoneNumberInternational', false);

        // 5. Upstream notifications and external items
        $content = $this->replaceOrInsertConfigParam($content, 'adminNotificationsNewVersion', false);
        $content = $this->replaceOrInsertConfigParam($content, 'adminNotificationsNewExtensionVersion', false);
        $content = $this->replaceOrInsertConfigParam($content, 'adminPanelIframeDisabled', true);

        // 6. Replace 'My Espo' tab in default dashboardLayout
        $content = preg_replace_callback(
            "/'name'\s*=>\s*'My Espo'/",
            static fn(): string => "'name' => " . var_export($defaultTab, true),
            $content
        );

        self::writeFile($path, $content);
        return true;
    }

    private function formatValue(mixed $value): string
    {
        if (is_array($value)) {
            $items = array_map(fn($v) => is_string($v) ? "'" . addcslashes($v, "'\\") . "'" : var_export($v, true), $value);
            return '[' . implode(', ', $items) . ']';
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_null($value)) {
            return 'null';
        }
        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }
        return "'" . addcslashes((string) $value, "'\\") . "'";
    }

    private function replaceOrInsertConfigParam(string $content, string $param, mixed $value): string
    {
        $formatted = $this->formatValue($value);
        $pattern = "/'" . preg_quote($param, '/') . "'\\s*=>\\s*/";
        if (preg_match($pattern, $content, $match, PREG_OFFSET_CAPTURE)) {
            $valueStart = $match[0][1] + strlen($match[0][0]);
            $valueEnd = $valueStart;
            $length = strlen($content);
            if (($content[$valueStart] ?? '') === '[') {
                $depth = 0;
                $quote = null;
                $escaped = false;
                $lineComment = false;
                $blockComment = false;
                for ($i = $valueStart; $i < $length; $i++) {
                    $char = $content[$i];
                    $next = $content[$i + 1] ?? '';
                    if ($lineComment) {
                        if ($char === "\n" || $char === "\r") { $lineComment = false; }
                        continue;
                    }
                    if ($blockComment) {
                        if ($char === '*' && $next === '/') { $blockComment = false; $i++; }
                        continue;
                    }
                    if ($quote !== null) {
                        if ($escaped) { $escaped = false; continue; }
                        if ($char === '\\') { $escaped = true; continue; }
                        if ($char === $quote) { $quote = null; }
                        continue;
                    }
                    if (($char === '/' && $next === '/') || $char === '#') { $lineComment = true; continue; }
                    if ($char === '/' && $next === '*') { $blockComment = true; $i++; continue; }
                    if ($char === "'" || $char === '"') { $quote = $char; continue; }
                    if ($char === '[') { $depth++; continue; }
                    if ($char === ']' && --$depth === 0) { $valueEnd = $i + 1; break; }
                }
                if ($valueEnd === $valueStart) {
                    throw new \RuntimeException("Unbalanced array for config parameter {$param}");
                }
                while ($valueEnd < $length && ctype_space($content[$valueEnd])) { $valueEnd++; }
                if (($content[$valueEnd] ?? '') === ',') { $valueEnd++; }
            } else {
                $quote = null;
                $escaped = false;
                $lineComment = false;
                $blockComment = false;
                for (; $valueEnd < $length; $valueEnd++) {
                    $char = $content[$valueEnd];
                    $next = $content[$valueEnd + 1] ?? '';
                    if ($lineComment) {
                        if ($char === "\n" || $char === "\r") { break; }
                        continue;
                    }
                    if ($blockComment) {
                        if ($char === '*' && $next === '/') { $blockComment = false; $valueEnd++; }
                        continue;
                    }
                    if ($quote !== null) {
                        if ($escaped) { $escaped = false; continue; }
                        if ($char === '\\') { $escaped = true; continue; }
                        if ($char === $quote) { $quote = null; }
                        continue;
                    }
                    if (($char === '/' && $next === '/') || $char === '#') { $lineComment = true; continue; }
                    if ($char === '/' && $next === '*') { $blockComment = true; $valueEnd++; continue; }
                    if ($char === "'" || $char === '"') { $quote = $char; continue; }
                    if ($char === ',' || $char === "\n" || $char === "\r") { break; }
                }
                if (($content[$valueEnd] ?? '') === ',') { $valueEnd++; }
            }
            return substr($content, 0, $valueStart) . $formatted . ',' . substr($content, $valueEnd);
        }

        $insert = "    '{$param}' => {$formatted},\n";
        $pos = strrpos($content, '];');
        if ($pos !== false) {
            $before = substr($content, 0, $pos);
            $after = substr($content, $pos);
            $trimmedBefore = rtrim($before);
            if (!str_ends_with($trimmedBefore, ',') && !str_ends_with($trimmedBefore, '[')) {
                $before = $trimmedBefore . ",\n";
            }
            return $before . $insert . $after;
        }

        throw new \RuntimeException("Unable to locate config array terminator for parameter {$param}");
    }

    public function generateNoticeFile(): bool
    {
        $name = $this->brand['name'] ?? 'Bidar CRM';
        $nameFa = $this->brand['nameFa'] ?? 'بیدار CRM';
        $websiteUrl = $this->validatedUrl((string) ($this->brand['websiteUrl'] ?? 'https://bidarcrm.ir'));
        $copyrightFa = $this->brand['copyrightFa'] ?? 'تمامی حقوق محفوظ است © ۱۴۰۵ بیدار CRM';
        $copyrightEn = $this->brand['copyrightEn'] ?? '© 2026 Bidar CRM. All rights reserved.';

        $notice = <<<TXT
================================================================================
{$name} ({$nameFa}) - Open-Source Legal & Attribution Notice
================================================================================

{$copyrightEn}
{$copyrightFa}
Website: {$websiteUrl}

--------------------------------------------------------------------------------
Upstream Base Software Attribution (GNU AGPLv3 Section 7(b))
--------------------------------------------------------------------------------

This software distribution incorporates and builds upon the EspoCRM open-source
application engine (https://www.espocrm.com).

In accordance with Section 7(b) of the GNU Affero General Public License version 3:
1. The underlying software engine is Copyright (C) 2014-2026 EspoCRM, Inc.
2. EspoCRM is licensed under the terms of the GNU Affero General Public License v3
   or later, as published by the Free Software Foundation.
3. Complete license details and warranty disclaimers are preserved in LICENSE.txt.

{$name} additions, custom modules, Persian localization, and extensions:
- Modules under custom/Espo/Modules/ (BidarSales, BidarIran, BidarBrand)
- Front-Office web client and integration layer
- Released under GNU AGPLv3 compliance.

For upstream source code, documentation, and original project details:
- Website: https://www.espocrm.com
- Repository: https://github.com/espocrm/espocrm
================================================================================
TXT;

        $path = $this->targetDir . '/NOTICE.txt';
        self::writeFile($path, $notice . "\n");
        return true;
    }
}

// -----------------------------------------------------------------------------
// CLI Runner (when invoked directly from command line)
// -----------------------------------------------------------------------------
if (php_sapi_name() === 'cli' && isset($argv[0]) && realpath($argv[0]) === __FILE__) {
    $shortopts = '';
    $longopts = [
        'target:',
        'brand::',
        'help',
    ];
    $options = getopt($shortopts, $longopts);

    if (isset($options['help']) || empty($options['target'])) {
        echo "Usage: php " . basename(__FILE__) . " --target=<target-dir> [--brand=<brand-json>]\n";
        exit(empty($options['target']) ? 1 : 0);
    }

    $targetDir = $options['target'];
    $rootDir = dirname(__DIR__);
    $brandFile = $options['brand'] ?? ($rootDir . '/config/brand.config.json');

    try {
        echo "==> Loading brand configuration from: {$brandFile}\n";
        echo "==> Applying white-label branding to target: {$targetDir}\n";

        $applier = WhiteLabelApplier::fromConfigFiles($targetDir, $brandFile, $rootDir);
        $results = $applier->apply();

        foreach ($results as $task => $success) {
            $status = $success ? '[OK]' : '[SKIP]';
            echo "  {$status} {$task}\n";
        }

        echo "==> White-label branding applied successfully.\n";
        exit(0);
    } catch (\Throwable $e) {
        fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
        exit(1);
    }
}
