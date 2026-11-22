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
