<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\Hook\Hook\AfterRemove;
use Espo\Core\Hook\Hook\AfterSave;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\Modules\BidarSales\Hooks\BidarDealItem\RecalculateOpportunityAmount;
use Espo\ORM\Entity;
use Espo\ORM\EntityCollection;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\Option\RemoveOptions;
use Espo\ORM\Repository\Option\SaveOptions;
use Espo\ORM\Repository\RDBRepository;
use Espo\ORM\Repository\RDBSelectBuilder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class DealItemCalculatorTest extends TestCase
{
    private string $metaPath;

    protected function setUp(): void
    {
        $this->metaPath = dirname(__DIR__, 2) . '/Resources/metadata';
    }

    public function testMetadataScopesAndEntityDefsExist(): void
    {
        // BidarProduct scope
        $productScopeFile = $this->metaPath . '/scopes/BidarProduct.json';
        $this->assertFileExists($productScopeFile);
        $productScope = json_decode((string) file_get_contents($productScopeFile), true);
        $this->assertTrue($productScope['entity'] ?? false);
        $this->assertTrue($productScope['tab'] ?? false);

        // BidarProduct entityDef
        $productDefFile = $this->metaPath . '/entityDefs/BidarProduct.json';
        $this->assertFileExists($productDefFile);
        $productDef = json_decode((string) file_get_contents($productDefFile), true);
        $fields = $productDef['fields'] ?? [];
        $this->assertArrayHasKey('name', $fields);
        $this->assertTrue($fields['name']['required'] ?? false);
        $this->assertArrayHasKey('sku', $fields);
        $this->assertArrayHasKey('unitPrice', $fields);
        $this->assertSame('currency', $fields['unitPrice']['type'] ?? null);
        $this->assertArrayHasKey('category', $fields);
        $this->assertArrayHasKey('isActive', $fields);

        // BidarDealItem scope
        $dealItemScopeFile = $this->metaPath . '/scopes/BidarDealItem.json';
        $this->assertFileExists($dealItemScopeFile);
        $dealItemScope = json_decode((string) file_get_contents($dealItemScopeFile), true);
        $this->assertTrue($dealItemScope['entity'] ?? false);

        // BidarDealItem entityDef
        $dealItemDefFile = $this->metaPath . '/entityDefs/BidarDealItem.json';
        $this->assertFileExists($dealItemDefFile);
        $dealItemDef = json_decode((string) file_get_contents($dealItemDefFile), true);
        $itemFields = $dealItemDef['fields'] ?? [];
        $this->assertArrayHasKey('quantity', $itemFields);
        $this->assertSame('float', $itemFields['quantity']['type'] ?? null);
        $this->assertArrayHasKey('unitPrice', $itemFields);
        $this->assertSame('currency', $itemFields['unitPrice']['type'] ?? null);
        $this->assertArrayHasKey('discountPercent', $itemFields);
        $this->assertSame('float', $itemFields['discountPercent']['type'] ?? null);
        $this->assertArrayHasKey('lineTotal', $itemFields);
        $this->assertSame('currency', $itemFields['lineTotal']['type'] ?? null);

        $itemLinks = $dealItemDef['links'] ?? [];
        $this->assertArrayHasKey('opportunity', $itemLinks);
        $this->assertSame('Opportunity', $itemLinks['opportunity']['entity'] ?? null);
        $this->assertArrayHasKey('product', $itemLinks);
        $this->assertSame('BidarProduct', $itemLinks['product']['entity'] ?? null);
    }

    public function testHookImplementsExpectedInterfaces(): void
    {
        $hook = new RecalculateOpportunityAmount();
        $this->assertInstanceOf(BeforeSave::class, $hook);
        $this->assertInstanceOf(AfterSave::class, $hook);
        $this->assertInstanceOf(AfterRemove::class, $hook);
    }

    public function testCalculateLineTotalWithoutDiscount(): void
    {
        // 2 items * 50,000 = 100,000
        $total = RecalculateOpportunityAmount::calculateLineTotal(2.0, 50000.0, 0.0);
        $this->assertSame(100000.0, $total);
    }

    public function testCalculateLineTotalWithDiscount(): void
    {
        // 3 items * 10,000 with 20% discount = 30,000 * 0.8 = 24,000
        $total = RecalculateOpportunityAmount::calculateLineTotal(3.0, 10000.0, 20.0);
        $this->assertSame(24000.0, $total);
    }

    public function testCalculateLineTotalWith100PercentOrExcessiveDiscount(): void
    {
        // 100% discount => 0
        $total100 = RecalculateOpportunityAmount::calculateLineTotal(1.0, 100000.0, 100.0);
        $this->assertSame(0.0, $total100);

        // 150% discount => clamped to 0
        $totalOver = RecalculateOpportunityAmount::calculateLineTotal(1.0, 100000.0, 150.0);
        $this->assertSame(0.0, $totalOver);
    }

    public function testCalculateTotalAmountAggregatesMultipleItems(): void
    {
        $items = [
            ['quantity' => 2, 'unitPrice' => 10000000, 'discountPercent' => 0],   // 20,000,000
            ['quantity' => 1, 'unitPrice' => 5000000, 'discountPercent' => 10],   // 4,500,000
            ['lineTotal' => 5500000],                                              // 5,500,000
        ];

        $total = RecalculateOpportunityAmount::calculateTotalAmount($items);
        $this->assertSame(30000000.0, $total);
    }

    public function testBeforeSaveCalculatesAndSetsLineTotal(): void
    {
        $hook = new RecalculateOpportunityAmount();

        $entity = $this->createMock(Entity::class);
        $entity->method('get')->willReturnCallback(function (string $name) {
            return match ($name) {
                'quantity' => 4.0,
                'unitPrice' => 25000.0,
                'discountPercent' => 10.0,
                default => null,
            };
        });

        $entity->expects($this->once())
            ->method('set')
            ->with('lineTotal', 90000.0); // 4 * 25,000 * 0.9 = 90,000

        $saveOptions = $this->createMock(SaveOptions::class);
        $hook->beforeSave($entity, $saveOptions);
    }

    public function testRecalculateOpportunityAmountUpdatesOpportunity(): void
    {
        $em = $this->createMock(EntityManager::class);
        $repo = $this->createMock(RDBRepository::class);
        $builder = $this->createMock(RDBSelectBuilder::class);

        $item1 = $this->createMock(Entity::class);
        $item1->method('get')->willReturnCallback(fn($k) => match ($k) {
            'quantity' => 2.0,
            'unitPrice' => 10000.0,
            'discountPercent' => 0.0,
            'lineTotal' => 20000.0,
            default => null,
        });

        $item2 = $this->createMock(Entity::class);
        $item2->method('get')->willReturnCallback(fn($k) => match ($k) {
            'quantity' => 1.0,
            'unitPrice' => 30000.0,
            'discountPercent' => 10.0,
            'lineTotal' => 27000.0,
            default => null,
        });

        $builder->method('find')->willReturn(new EntityCollection([$item1, $item2]));
        $repo->method('where')->with(['opportunityId' => 'opp-1'])->willReturn($builder);

        $em->method('getRDBRepository')->with('BidarDealItem')->willReturn($repo);

        $opportunity = $this->createMock(Entity::class);
        $opportunity->expects($this->once())
            ->method('set')
            ->with('amount', 47000.0); // 20,000 + 27,000 = 47,000

        $em->method('getEntityById')->with('Opportunity', 'opp-1')->willReturn($opportunity);

        $em->expects($this->once())
            ->method('saveEntity')
            ->with($opportunity, [
                'silent' => true,
            ]);

        $hook = new RecalculateOpportunityAmount($em);
        $calculated = $hook->recalculateOpportunityAmount('opp-1');

        $this->assertSame(47000.0, $calculated);
    }

    public function testAfterSaveTriggersRecalculation(): void
    {
        $em = $this->createMock(EntityManager::class);
        $repo = $this->createMock(RDBRepository::class);
        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('find')->willReturn(new EntityCollection([]));
        $repo->method('where')->willReturn($builder);

        $em->method('getRDBRepository')->with('BidarDealItem')->willReturn($repo);
        $opportunity = $this->createMock(Entity::class);
        $em->method('getEntityById')->with('Opportunity', 'opp-test')->willReturn($opportunity);

        $hook = new RecalculateOpportunityAmount($em);

        $entity = $this->createMock(Entity::class);
        $entity->method('get')->with('opportunityId')->willReturn('opp-test');

        $saveOptions = $this->createMock(SaveOptions::class);
        $hook->afterSave($entity, $saveOptions);
    }

    public function testAfterRemoveTriggersRecalculation(): void
    {
        $em = $this->createMock(EntityManager::class);
        $repo = $this->createMock(RDBRepository::class);
        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('find')->willReturn(new EntityCollection([]));
        $repo->method('where')->willReturn($builder);

        $em->method('getRDBRepository')->with('BidarDealItem')->willReturn($repo);
        $opportunity = $this->createMock(Entity::class);
        $em->method('getEntityById')->with('Opportunity', 'opp-test')->willReturn($opportunity);

        $hook = new RecalculateOpportunityAmount($em);

        $entity = $this->createMock(Entity::class);
        $entity->method('get')->with('opportunityId')->willReturn('opp-test');

        $removeOptions = $this->createMock(RemoveOptions::class);
        $hook->afterRemove($entity, $removeOptions);
    }

    public function testCalculateLineTotalRejectsNegativeInputs(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        RecalculateOpportunityAmount::calculateLineTotal(-2.0, 10000.0, 0.0);
    }

    public function testCalculateLineTotalRejectsNegativeDiscount(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        RecalculateOpportunityAmount::calculateLineTotal(2.0, 10000.0, -50.0);
    }

    public function testCalculateTotalAmountClampsNegativeLineTotal(): void
    {
        $total = RecalculateOpportunityAmount::calculateTotalAmount([
            ['lineTotal' => -5000.0],
        ]);
        $this->assertSame(0.0, $total);
    }

    public function testBeforeSaveRejectsNegativeQuantityWithBadRequest(): void
    {
        $hook = new RecalculateOpportunityAmount();
        $entity = $this->createMock(Entity::class);
        $entity->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'quantity' => -1.0,
            'unitPrice' => 1000.0,
            'discountPercent' => 0.0,
            default => null,
        });

        $this->expectException(\Espo\Core\Exceptions\BadRequest::class);
        $hook->beforeSave($entity, $this->createMock(SaveOptions::class));
    }

    public function testAfterSaveRecalculatesOldAndNewOpportunityOnReassignment(): void
    {
        $em = $this->createMock(EntityManager::class);
        $repo = $this->createMock(RDBRepository::class);
        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('find')->willReturn(new EntityCollection([]));

        $seenOppIds = [];
        $repo->method('where')->willReturnCallback(function (array $where) use (&$seenOppIds, $builder) {
            $seenOppIds[] = $where['opportunityId'] ?? null;
            return $builder;
        });
        $em->method('getRDBRepository')->with('BidarDealItem')->willReturn($repo);

        $opp = $this->createMock(Entity::class);
        $em->method('getEntityById')->willReturn($opp);

        $hook = new RecalculateOpportunityAmount($em);

        $entity = $this->createMock(Entity::class);
        $entity->method('get')->with('opportunityId')->willReturn('opp-new');
        $entity->method('getFetched')->with('opportunityId')->willReturn('opp-old');
        $entity->method('isAttributeChanged')->with('opportunityId')->willReturn(true);

        $hook->afterSave($entity, $this->createMock(SaveOptions::class));

        $this->assertSame(['opp-new', 'opp-old'], $seenOppIds);
    }

    public function testCalculateLineTotalRejectsNegativeUnitPrice(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        RecalculateOpportunityAmount::calculateLineTotal(2.0, -10000.0, 0.0);
    }

    public static function invalidBeforeSaveValuesProvider(): array
    {
        return [
            'negative unit price' => [2.0, -1000.0, 0.0],
            'negative discount' => [2.0, 1000.0, -1.0],
            'discount over 100' => [2.0, 1000.0, 100.1],
        ];
    }

    #[DataProvider('invalidBeforeSaveValuesProvider')]
    public function testBeforeSaveRejectsInvalidValues(float $quantity, float $unitPrice, float $discountPercent): void
    {
        $hook = new RecalculateOpportunityAmount();
        $entity = $this->createMock(Entity::class);
        $entity->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'quantity' => $quantity,
            'unitPrice' => $unitPrice,
            'discountPercent' => $discountPercent,
            default => null,
        });
        $entity->expects($this->never())->method('set');

        $this->expectException(\Espo\Core\Exceptions\BadRequest::class);
        $hook->beforeSave($entity, $this->createMock(SaveOptions::class));
    }

    public function testBeforeSavePropagatesCurrencyToLineTotal(): void
    {
        $hook = new RecalculateOpportunityAmount();
        $entity = $this->createMock(Entity::class);
        $entity->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'quantity' => 2.0,
            'unitPrice' => 100.0,
            'discountPercent' => 0.0,
            'unitPriceCurrency' => 'USD',
            default => null,
        });
        $entity->expects($this->exactly(2))->method('set')->willReturnCallback(function ($key, $value) use ($entity) {
            if ($key === 'lineTotal') {
                $this->assertSame(200.0, $value);
            } elseif ($key === 'lineTotalCurrency') {
                $this->assertSame('USD', $value);
            }
            return $entity;
        });

        $hook->beforeSave($entity, $this->createMock(SaveOptions::class));
    }

    public function testRecalculateUsesEpsilonBeforePersistingLineTotal(): void
    {
        $insideTransaction = false;
        $transactionManager = $this->createMock(\Espo\ORM\TransactionManager::class);
        $transactionManager->method('start')->willReturnCallback(function () use (&$insideTransaction): void {
            $insideTransaction = true;
        });
        $transactionManager->method('commit')->willReturnCallback(function () use (&$insideTransaction): void {
            $insideTransaction = false;
        });

        $item = $this->createMock(Entity::class);
        $item->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'quantity' => 1.0,
            'unitPrice' => 100.0,
            'discountPercent' => 0.0,
            'lineTotal' => '100.00005',
            'lineTotalCurrency' => 'USD',
            default => null,
        });
        $item->expects($this->never())->method('set');

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('find')->willReturn(new EntityCollection([$item]));
        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->with(['opportunityId' => 'opp-1'])->willReturn($builder);

        $opportunity = $this->createMock(Entity::class);
        $opportunity->expects($this->exactly(2))->method('set')->willReturnCallback(function ($key, $value) use (&$insideTransaction, $opportunity) {
            $this->assertTrue($insideTransaction);
            if ($key === 'amount') {
                $this->assertSame(100.0, $value);
            } elseif ($key === 'amountCurrency') {
                $this->assertSame('USD', $value);
            }
            return $opportunity;
        });

        $em = $this->createMock(EntityManager::class);
        $em->method('getTransactionManager')->willReturn($transactionManager);
        $em->method('getRDBRepository')->with('BidarDealItem')->willReturn($repo);
        $em->method('getEntityById')->with('Opportunity', 'opp-1')->willReturn($opportunity);
        $em->expects($this->once())->method('saveEntity')->with($opportunity, ['silent' => true])
            ->willReturnCallback(function () use (&$insideTransaction): void {
                $this->assertTrue($insideTransaction);
            });

        $hook = new RecalculateOpportunityAmount($em);
        $this->assertSame(100.0, $hook->recalculateOpportunityAmount('opp-1'));
        $this->assertFalse($insideTransaction);
    }

    public function testRecalculateRejectsMixedCurrenciesWithoutUpdatingOpportunity(): void
    {
        $transactionManager = $this->createMock(\Espo\ORM\TransactionManager::class);
        $transactionManager->expects($this->once())->method('start');
        $transactionManager->expects($this->once())->method('rollback');
        $transactionManager->expects($this->never())->method('commit');

        $usdItem = $this->createMock(Entity::class);
        $usdItem->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'quantity' => 1.0,
            'unitPrice' => 100.0,
            'discountPercent' => 0.0,
            'lineTotal' => 100.0,
            'lineTotalCurrency' => 'USD',
            default => null,
        });
        $eurItem = $this->createMock(Entity::class);
        $eurItem->method('get')->willReturnCallback(fn (string $name) => match ($name) {
            'quantity' => 1.0,
            'unitPrice' => 200.0,
            'discountPercent' => 0.0,
            'lineTotal' => 200.0,
            'lineTotalCurrency' => 'EUR',
            default => null,
        });

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('find')->willReturn(new EntityCollection([$usdItem, $eurItem]));
        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->with(['opportunityId' => 'opp-mixed'])->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getTransactionManager')->willReturn($transactionManager);
        $em->method('getRDBRepository')->with('BidarDealItem')->willReturn($repo);
        $em->expects($this->never())->method('getEntityById');
        $em->expects($this->never())->method('saveEntity');

        $hook = new RecalculateOpportunityAmount($em);

        $this->expectException(\Espo\Core\Exceptions\BadRequest::class);
        $this->expectExceptionMessage('different currencies');
        $hook->recalculateOpportunityAmount('opp-mixed');
    }
}
