<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarSales\Seed\DefaultPipelineSeeder;

class PipelineMetadataTest extends TestCase
{
    private string $metaPath;

    protected function setUp(): void
    {
        $this->metaPath = dirname(__DIR__, 2) . '/Resources/metadata';
    }

    public function testOpportunityScopeEnablesNativePipelines(): void
    {
        $scopeFile = $this->metaPath . '/scopes/Opportunity.json';
        $this->assertFileExists($scopeFile, 'scopes/Opportunity.json must exist');

        $data = json_decode((string) file_get_contents($scopeFile), true);
        $this->assertIsArray($data);
        $this->assertTrue($data['pipelines'] ?? false, 'Opportunity scope must set pipelines: true');
    }

    public function testPipelineStageEntityDefHasRottenDaysField(): void
    {
        $stageDefFile = $this->metaPath . '/entityDefs/PipelineStage.json';
        $this->assertFileExists($stageDefFile, 'entityDefs/PipelineStage.json must exist');

        $data = json_decode((string) file_get_contents($stageDefFile), true);
        $this->assertIsArray($data);

        $fields = $data['fields'] ?? [];
        $this->assertArrayHasKey('rottenDays', $fields);
        $this->assertSame('int', $fields['rottenDays']['type'] ?? null);
        $this->assertSame(1, $fields['rottenDays']['min'] ?? null);
    }

    public function testOpportunityEntityDefHasRottenTrackingFields(): void
    {
        $oppDefFile = $this->metaPath . '/entityDefs/Opportunity.json';
        $this->assertFileExists($oppDefFile, 'entityDefs/Opportunity.json must exist');

        $data = json_decode((string) file_get_contents($oppDefFile), true);
        $this->assertIsArray($data);

        $fields = $data['fields'] ?? [];
        $this->assertArrayHasKey('lastActivityAt', $fields);
        $this->assertSame('datetime', $fields['lastActivityAt']['type'] ?? null);

        $this->assertArrayHasKey('isRotten', $fields);
        $this->assertSame('bool', $fields['isRotten']['type'] ?? null);
        $this->assertTrue($fields['isRotten']['notStorable'] ?? false);

        $this->assertArrayHasKey('daysSinceLastActivity', $fields);
        $this->assertSame('int', $fields['daysSinceLastActivity']['type'] ?? null);
        $this->assertTrue($fields['daysSinceLastActivity']['notStorable'] ?? false);

        $this->assertArrayHasKey('lossReason', $fields);
        $this->assertSame('enum', $fields['lossReason']['type'] ?? null);
        $this->assertContains('PriceTooHigh', $fields['lossReason']['options'] ?? []);
        $this->assertContains('Competitor', $fields['lossReason']['options'] ?? []);

        $this->assertArrayHasKey('lossReasonNote', $fields);
        $this->assertSame('text', $fields['lossReasonNote']['type'] ?? null);
    }

    public function testCustomerGroupsMetadataDefinedForContactAndAccount(): void
    {
        foreach (['Contact', 'Account'] as $entityName) {
            $file = $this->metaPath . "/entityDefs/{$entityName}.json";
            $this->assertFileExists($file);

            $data = json_decode((string) file_get_contents($file), true);
            $this->assertIsArray($data);
            $this->assertArrayHasKey('fields', $data);
            $this->assertArrayHasKey('customerGroups', $data['fields']);

            $cg = $data['fields']['customerGroups'];
            $this->assertSame('multiEnum', $cg['type'] ?? null);
            $this->assertContains('VIP', $cg['options'] ?? []);
            $this->assertContains('Reseller', $cg['options'] ?? []);
            $this->assertContains('Loyal', $cg['options'] ?? []);
            $this->assertContains('Exhibition', $cg['options'] ?? []);
            $this->assertContains('FirstPurchase', $cg['options'] ?? []);

            $i18nFile = dirname($this->metaPath) . "/i18n/fa_IR/{$entityName}.json";
            $this->assertFileExists($i18nFile);
            $i18nData = json_decode((string) file_get_contents($i18nFile), true);
            $this->assertSame('گروه‌های مشتری', $i18nData['fields']['customerGroups'] ?? null);
            $this->assertSame('نماینده', $i18nData['options']['customerGroups']['Reseller'] ?? null);
        }
    }

    public function testBidarGoalMetadataDefined(): void
    {
        $scopeFile = $this->metaPath . '/scopes/BidarGoal.json';
        $this->assertFileExists($scopeFile);
        $scope = json_decode((string) file_get_contents($scopeFile), true);
        $this->assertTrue($scope['entity'] ?? false);
        $this->assertTrue($scope['tab'] ?? false);

        $defFile = $this->metaPath . '/entityDefs/BidarGoal.json';
        $this->assertFileExists($defFile);
        $def = json_decode((string) file_get_contents($defFile), true);
        $fields = $def['fields'] ?? [];

        $this->assertArrayHasKey('name', $fields);
        $this->assertTrue($fields['name']['required'] ?? false);
        $this->assertArrayHasKey('metricType', $fields);
        $this->assertSame('enum', $fields['metricType']['type'] ?? null);
        $this->assertContains('wonAmount', $fields['metricType']['options'] ?? []);
        $this->assertContains('wonCount', $fields['metricType']['options'] ?? []);
        $this->assertContains('dealsCreated', $fields['metricType']['options'] ?? []);
        $this->assertContains('activitiesHeld', $fields['metricType']['options'] ?? []);

        $this->assertArrayHasKey('scopeType', $fields);
        $this->assertArrayHasKey('period', $fields);
        $this->assertArrayHasKey('dateStart', $fields);
        $this->assertArrayHasKey('dateEnd', $fields);
        $this->assertArrayHasKey('targetValue', $fields);
        $this->assertSame('float', $fields['targetValue']['type'] ?? null);
        $this->assertTrue($fields['targetValue']['required'] ?? false);
    }

    public function testTaskClientDefsEnablesKanbanViewMode(): void
    {
        $file = $this->metaPath . '/clientDefs/Task.json';
        $this->assertFileExists($file);

        $data = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($data);
        $this->assertTrue($data['kanbanViewMode'] ?? false);
        $this->assertArrayHasKey('kanbanStatusIgnoreList', $data);
        $this->assertIsArray($data['kanbanStatusIgnoreList']);
    }

    public function testDefaultPipelineSeederReturnsStandardPersianPipelineDefinition(): void
    {
        $seeder = new DefaultPipelineSeeder();
        $definition = $seeder->getDefaultPipelineDefinition();

        $this->assertSame('کاریز اصلی فروش', $definition['name']);
        $this->assertCount(5, $definition['stages']);

        $stages = $definition['stages'];
        $this->assertSame('تماس اولیه', $stages[0]['name']);
        $this->assertSame(3, $stages[0]['rottenDays']);

        $this->assertSame('پیگیری و مذاکره', $stages[1]['name']);
        $this->assertSame(5, $stages[1]['rottenDays']);

        $this->assertSame('ارسال پیش‌فاکتور', $stages[2]['name']);
        $this->assertSame(4, $stages[2]['rottenDays']);

        $this->assertSame('موفق (برنده)', $stages[3]['name']);
        $this->assertSame('Closed Won', $stages[3]['probability'] ?? null);

        $this->assertSame('ناموفق (از دست رفته)', $stages[4]['name']);
        $this->assertSame('Closed Lost', $stages[4]['probability'] ?? null);
    }
}
