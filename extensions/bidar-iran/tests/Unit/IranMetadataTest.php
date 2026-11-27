<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;

class IranMetadataTest extends TestCase
{
    private string $resourcesDir;

    protected function setUp(): void
    {
        $this->resourcesDir = dirname(__DIR__, 2) . '/Resources';
    }

    public function testCurrencyMetadataIsValid(): void
    {
        $path = $this->resourcesDir . '/metadata/app/currency.json';
        $this->assertFileExists($path);
        $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        $this->assertContains('IRT', $data['list']);
        $this->assertSame('تومان', $data['symbolMap']['IRT']);
        $this->assertSame('ریال', $data['symbolMap']['IRR']);
        $this->assertSame(0, $data['precisionMap']['IRT']);
        $this->assertSame(0, $data['precisionMap']['IRR']);
    }

    public function testGlobalI18nContainsRequiredTerminology(): void
    {
        $path = $this->resourcesDir . '/i18n/fa_IR/Global.json';
        $this->assertFileExists($path);
        $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        // Standard translations
        $this->assertSame('معامله', $data['scopeNames']['Opportunity']);
        $this->assertSame('معاملات', $data['scopeNamesPlural']['Opportunity']);
        $this->assertSame('کاریز', $data['scopeNames']['Pipeline']);
        $this->assertSame('کاریزها', $data['scopeNamesPlural']['Pipeline']);
        $this->assertSame('سرنخ فروش', $data['scopeNames']['Lead']);
        $this->assertSame('سرنخ‌های فروش', $data['scopeNamesPlural']['Lead']);
        $this->assertSame('شرکت', $data['scopeNames']['Account']);
        $this->assertSame('شرکت‌ها', $data['scopeNamesPlural']['Account']);
        $this->assertSame('شخص', $data['scopeNames']['Contact']);
        $this->assertSame('اشخاص', $data['scopeNamesPlural']['Contact']);
        $this->assertSame('تماس', $data['scopeNames']['Call']);
        $this->assertSame('جلسه', $data['scopeNames']['Meeting']);
        $this->assertSame('وظیفه', $data['scopeNames']['Task']);
        $this->assertSame('تایم‌لاین تعاملات', $data['scopeNames']['Stream']);
        $this->assertSame('نشانگر', $data['scopeNames']['Dashboard']);

        // Labels
        $this->assertSame('معامله راکد', $data['labels']['isRotten']);
        $this->assertSame('فروش موفق', $data['labels']['Closed Won']);
        $this->assertSame('شکست‌خورده', $data['labels']['Closed Lost']);

        // Currencies
        $this->assertSame('تومان ایران', $data['options']['currency']['IRT']);
        $this->assertSame('ریال ایران', $data['options']['currency']['IRR']);
    }

    public function testAccountMetadataAndI18n(): void
    {
        $metaPath = $this->resourcesDir . '/metadata/entityDefs/Account.json';
        $this->assertFileExists($metaPath);
        $meta = json_decode((string) file_get_contents($metaPath), true, 512, JSON_THROW_ON_ERROR);

        $this->assertArrayHasKey('nationalId', $meta['fields']);
        $this->assertSame('varchar', $meta['fields']['nationalId']['type']);
        $this->assertSame(11, $meta['fields']['nationalId']['maxLength']);

        $this->assertArrayHasKey('economicCode', $meta['fields']);
        $this->assertSame(14, $meta['fields']['economicCode']['maxLength']);

        $this->assertArrayHasKey('registrationNumber', $meta['fields']);
        $this->assertSame(20, $meta['fields']['registrationNumber']['maxLength']);

        $this->assertArrayHasKey('iranProvince', $meta['fields']);
        $this->assertSame('enum', $meta['fields']['iranProvince']['type']);
        $this->assertCount(32, $meta['fields']['iranProvince']['options']); // empty + 31 provinces

        $this->assertArrayHasKey('iranCity', $meta['fields']);
        $this->assertSame(64, $meta['fields']['iranCity']['maxLength']);

        $i18nPath = $this->resourcesDir . '/i18n/fa_IR/Account.json';
        $this->assertFileExists($i18nPath);
        $i18n = json_decode((string) file_get_contents($i18nPath), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('شناسه ملی شرکت', $i18n['fields']['nationalId']);
        $this->assertSame('کد اقتصادی', $i18n['fields']['economicCode']);
        $this->assertSame('شماره ثبت', $i18n['fields']['registrationNumber']);
        $this->assertSame('استان', $i18n['fields']['iranProvince']);
        $this->assertSame('شهر', $i18n['fields']['iranCity']);
    }

    public function testContactMetadataAndI18n(): void
    {
        $metaPath = $this->resourcesDir . '/metadata/entityDefs/Contact.json';
        $this->assertFileExists($metaPath);
        $meta = json_decode((string) file_get_contents($metaPath), true, 512, JSON_THROW_ON_ERROR);

        $this->assertArrayHasKey('nationalCode', $meta['fields']);
        $this->assertSame('varchar', $meta['fields']['nationalCode']['type']);
        $this->assertSame(10, $meta['fields']['nationalCode']['maxLength']);

        $this->assertArrayHasKey('birthDate', $meta['fields']);
        $this->assertSame('date', $meta['fields']['birthDate']['type']);

        $i18nPath = $this->resourcesDir . '/i18n/fa_IR/Contact.json';
        $this->assertFileExists($i18nPath);
        $i18n = json_decode((string) file_get_contents($i18nPath), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('کد ملی', $i18n['fields']['nationalCode']);
        $this->assertSame('تاریخ تولد', $i18n['fields']['birthDate']);
    }

    public function testIntegrationCredentialsUsePasswordFieldsAndTranslationsExist(): void
    {
        $voip = json_decode((string) file_get_contents($this->resourcesDir . '/metadata/integrations/BidarVoip.json'), true, 512, JSON_THROW_ON_ERROR);
        $kavenegar = json_decode((string) file_get_contents($this->resourcesDir . '/metadata/integrations/Kavenegar.json'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('password', $voip['fields']['webhookSecret']['type']);
        $this->assertSame('password', $kavenegar['fields']['apiKey']['type']);

        $global = json_decode((string) file_get_contents($this->resourcesDir . '/i18n/fa_IR/Global.json'), true, 512, JSON_THROW_ON_ERROR);
        foreach (['BidarSmsTemplate', 'BidarSmsMessage'] as $scope) {
            $this->assertArrayHasKey($scope, $global['scopeNames']);
            $this->assertArrayHasKey($scope, $global['scopeNamesPlural']);
        }

        $integrationPath = $this->resourcesDir . '/i18n/fa_IR/Integration.json';
        $this->assertFileExists($integrationPath);
        $translations = json_decode((string) file_get_contents($integrationPath), true, 512, JSON_THROW_ON_ERROR);
        $this->assertArrayHasKey('Kavenegar', $translations);
        $this->assertArrayHasKey('BidarVoip', $translations);
    }

    public function testSmsMessageLookupFieldsAreIndexedAndRelationsRemainDefined(): void
    {
        $meta = json_decode((string) file_get_contents($this->resourcesDir . '/metadata/entityDefs/BidarSmsMessage.json'), true, 512, JSON_THROW_ON_ERROR);
        $fields = $meta['fields'];
        $this->assertTrue($fields['phoneNumber']['index'] ?? false);
        $this->assertTrue($fields['status']['index'] ?? false);
        $this->assertArrayHasKey('contactId', $fields);
        $this->assertArrayHasKey('opportunityId', $fields);
    }
}
