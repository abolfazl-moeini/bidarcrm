<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Hooks\BidarDealItem;

use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Hook\Hook\AfterRemove;
use Espo\Core\Hook\Hook\AfterSave;
use Espo\Core\Hook\Hook\BeforeSave;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\Option\RemoveOptions;
use Espo\ORM\Repository\Option\SaveOptions;

class RecalculateOpportunityAmount implements BeforeSave, AfterSave, AfterRemove
{
    private ?EntityManager $entityManager;

    public function __construct(?EntityManager $entityManager = null)
    {
        $this->entityManager = $entityManager;
    }

    /**
     * Compute line total: max(0, quantity * unitPrice * (1 - discountPercent / 100))
     */
    public static function calculateLineTotal(float $quantity, float $unitPrice, float $discountPercent = 0.0): float
    {
        if ($quantity < 0 || $unitPrice < 0 || $discountPercent < 0) {
            throw new \InvalidArgumentException('Quantity, unitPrice, and discountPercent must be non-negative.');
        }

        $effectiveDiscount = min(100.0, $discountPercent);
        $discountFactor = 1.0 - ($effectiveDiscount / 100.0);
        $total = $quantity * $unitPrice * $discountFactor;

        return round(max(0.0, $total), 2);
    }

    /**
     * Compute sum of all deal items.
     *
     * @param list<array<string, mixed>> $items
     */
    public static function calculateTotalAmount(array $items): float
    {
        $total = 0.0;
        foreach ($items as $item) {
            if (isset($item['lineTotal'])) {
                $total += max(0.0, (float) $item['lineTotal']);
            } else {
                $quantity = (float) ($item['quantity'] ?? 1.0);
                $unitPrice = (float) ($item['unitPrice'] ?? 0.0);
                $discountPercent = (float) ($item['discountPercent'] ?? 0.0);
                $total += self::calculateLineTotal($quantity, $unitPrice, $discountPercent);
            }
        }

        return round(max(0.0, $total), 2);
    }

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $quantity = (float) ($entity->get('quantity') ?? 1.0);
        $unitPrice = (float) ($entity->get('unitPrice') ?? 0.0);
        $discountPercent = (float) ($entity->get('discountPercent') ?? 0.0);

        if ($quantity < 0 || $unitPrice < 0 || $discountPercent < 0 || $discountPercent > 100) {
            throw new BadRequest('Invalid deal item values: quantity and unitPrice must be >= 0, discountPercent must be between 0 and 100.');
        }

        $lineTotal = self::calculateLineTotal($quantity, $unitPrice, $discountPercent);
        $entity->set('lineTotal', $lineTotal);

        $unitPriceCurrency = $entity->get('unitPriceCurrency');
        if (is_string($unitPriceCurrency) && $unitPriceCurrency !== '') {
            $entity->set('lineTotalCurrency', $unitPriceCurrency);
        }
    }

    public function afterSave(Entity $entity, SaveOptions $options): void
    {
        if ($this->entityManager === null) {
            return;
        }

        $opportunityId = $entity->get('opportunityId');
        if (!empty($opportunityId)) {
            $this->recalculateOpportunityAmount((string) $opportunityId);
        }

        if ($entity->isAttributeChanged('opportunityId')) {
            $oldOpportunityId = $entity->getFetched('opportunityId');
            if (!empty($oldOpportunityId) && $oldOpportunityId !== $opportunityId) {
                $this->recalculateOpportunityAmount((string) $oldOpportunityId);
            }
        }
    }

    public function afterRemove(Entity $entity, RemoveOptions $options): void
    {
        $opportunityId = $entity->get('opportunityId');
        if (!empty($opportunityId) && $this->entityManager !== null) {
            $this->recalculateOpportunityAmount((string) $opportunityId);
        }
    }

    /**
     * Recalculate and update Opportunity amount from all related items.
     */
    public function recalculateOpportunityAmount(string $opportunityId): float
    {
        if ($this->entityManager === null) {
            return 0.0;
        }

        $txManager = $this->entityManager->getTransactionManager();
        $txManager->start();
        try {
            $items = $this->entityManager->getRDBRepository('BidarDealItem')
                ->where(['opportunityId' => $opportunityId])
                ->find();

            $totalAmount = 0.0;
            $detectedCurrency = null;
            $itemsToUpdate = [];

            foreach ($items as $item) {
                $quantity = (float) ($item->get('quantity') ?? 1.0);
                $unitPrice = (float) ($item->get('unitPrice') ?? 0.0);
                $discountPercent = (float) ($item->get('discountPercent') ?? 0.0);

                $lineTotal = self::calculateLineTotal($quantity, $unitPrice, $discountPercent);

                $itemCurrency = $item->get('lineTotalCurrency') ?? $item->get('unitPriceCurrency');
                if (is_string($itemCurrency) && $itemCurrency !== '') {
                    if ($detectedCurrency === null) {
                        $detectedCurrency = $itemCurrency;
                    } elseif ($detectedCurrency !== $itemCurrency) {
                        throw new BadRequest('Cannot aggregate deal items with different currencies.');
                    }
                }

                $totalAmount += $lineTotal;
                $currentLineTotal = $item->get('lineTotal');
                if ($currentLineTotal === null || abs((float) $currentLineTotal - $lineTotal) > 0.0001) {
                    $item->set('lineTotal', $lineTotal);
                    $itemsToUpdate[] = $item;
                }
            }

            foreach ($itemsToUpdate as $item) {
                $this->entityManager->saveEntity($item, [
                    'silent' => true,
                    'skipHooks' => true,
                ]);
            }

            $totalAmount = round(max(0.0, $totalAmount), 2);

            $opportunity = $this->entityManager->getEntityById('Opportunity', $opportunityId);
            if ($opportunity !== null) {
                $opportunity->set('amount', $totalAmount);
                if ($detectedCurrency !== null) {
                    $opportunity->set('amountCurrency', $detectedCurrency);
                }
                $this->entityManager->saveEntity($opportunity, [
                    'silent' => true,
                ]);
            }

            $txManager->commit();
            return $totalAmount;
        } catch (\Throwable $e) {
            $txManager->rollback();
            throw $e;
        }
    }
}
