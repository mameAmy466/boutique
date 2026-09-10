<?php

namespace App\Services;

use App\Exceptions\PriceBelowMinimumException;
use App\Models\ProductBatch;

/**
 * Centralizes the pricing rules of the system:
 *
 *   coût de revient = prix d'achat + frais associés
 *   prix minimum    = coût de revient + bénéfice minimum
 *
 * The seller may sell at or above the minimum price, never below it.
 * This rule must always be enforced here (server-side) so it cannot be
 * bypassed by a client application.
 */
class PricingService
{
    public function computeCostPrice(float $purchaseCost, float $additionalCosts): float
    {
        return round($purchaseCost + $additionalCosts, 2);
    }

    public function computeMinPrice(float $costPrice, float $minProfitAmount): float
    {
        return round($costPrice + $minProfitAmount, 2);
    }

    /**
     * @throws PriceBelowMinimumException
     */
    public function assertValidSalePrice(ProductBatch $batch, float $unitPrice): void
    {
        if ($unitPrice < (float) $batch->min_price) {
            throw new PriceBelowMinimumException((float) $batch->min_price, $unitPrice);
        }
    }
}
