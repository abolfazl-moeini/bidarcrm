<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class BidarEntityMetadataHardeningTest extends TestCase
{
    private function readFields(string $entityType): array
    {
        $path = dirname(__DIR__, 2) . '/Resources/metadata/entityDefs/' . $entityType . '.json';
        $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        return $data['fields'];
    }

    public function testApiKeyMetadataProtectsInternalHashAndOwnershipFields(): void
    {
        $fields = $this->readFields('BidarUserApiKey');

        $this->assertTrue($fields['keyHash']['internal']);
        $this->assertTrue($fields['userId']['readOnly']);
        $this->assertTrue($fields['revokedByUserId']['readOnly']);
    }

    public function testDealItemMetadataEnforcesNumericBounds(): void
    {
        $fields = $this->readFields('BidarDealItem');

        $this->assertSame(0, $fields['quantity']['min']);
        $this->assertSame(0, $fields['unitPrice']['min']);
        $this->assertSame(0, $fields['discountPercent']['min']);
        $this->assertSame(100, $fields['discountPercent']['max']);
    }
}
