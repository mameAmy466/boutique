<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StockService
{
    public function __construct(private readonly PricingService $pricing) {}

    public function receiveBatch(
        Product $product,
        Shop $shop,
        float $purchaseCost,
        float $additionalCosts,
        float $minProfitAmount,
        int $quantity,
        User $receivedBy,
        ?int $supplierId = null,
    ): ProductBatch {
        return DB::transaction(function () use (
            $product, $shop, $purchaseCost, $additionalCosts, $minProfitAmount, $quantity, $receivedBy, $supplierId
        ) {
            $costPrice = $this->pricing->computeCostPrice($purchaseCost, $additionalCosts);
            $minPrice = $this->pricing->computeMinPrice($costPrice, $minProfitAmount);

            $batch = ProductBatch::create([
                'batch_code' => 'PENDING',
                'product_id' => $product->id,
                'shop_id' => $shop->id,
                'supplier_id' => $supplierId,
                'purchase_cost' => $purchaseCost,
                'additional_costs' => $additionalCosts,
                'cost_price' => $costPrice,
                'min_profit_amount' => $minProfitAmount,
                'min_price' => $minPrice,
                'quantity_received' => $quantity,
                'quantity_available' => $quantity,
                'received_at' => now(),
                'received_by' => $receivedBy->id,
            ]);

            $batch->update([
                'batch_code' => sprintf('%s-%d-%06d', strtoupper($shop->code), now()->year, $batch->id),
            ]);

            StockMovement::create([
                'product_batch_id' => $batch->id,
                'shop_id' => $shop->id,
                'type' => StockMovement::TYPE_ENTRY,
                'quantity' => $quantity,
                'note' => 'Réception de marchandises',
                'user_id' => $receivedBy->id,
            ]);

            return $batch;
        });
    }

    /**
     * Reconcile a physical inventory count against the system quantity,
     * logging the adjustment with a mandatory justification.
     */
    public function adjustToPhysicalCount(ProductBatch $batch, int $physicalQuantity, string $reason, User $actor): ProductBatch
    {
        return DB::transaction(function () use ($batch, $physicalQuantity, $reason, $actor) {
            $batch = ProductBatch::query()->lockForUpdate()->findOrFail($batch->id);
            $difference = $physicalQuantity - $batch->quantity_available;

            $batch->update(['quantity_available' => $physicalQuantity]);

            StockMovement::create([
                'product_batch_id' => $batch->id,
                'shop_id' => $batch->shop_id,
                'type' => StockMovement::TYPE_ADJUSTMENT,
                'quantity' => $difference,
                'note' => $reason,
                'user_id' => $actor->id,
            ]);

            return $batch;
        });
    }

    /**
     * Record damage, loss, theft or expiration removing stock from a batch.
     */
    public function recordShrinkage(ProductBatch $batch, int $quantity, string $type, ?string $note, User $actor): ProductBatch
    {
        return DB::transaction(function () use ($batch, $quantity, $type, $note, $actor) {
            $batch = ProductBatch::query()->lockForUpdate()->findOrFail($batch->id);

            if ($batch->quantity_available < $quantity) {
                throw new InsufficientStockException($batch->quantity_available, $quantity);
            }

            $batch->decrement('quantity_available', $quantity);

            StockMovement::create([
                'product_batch_id' => $batch->id,
                'shop_id' => $batch->shop_id,
                'type' => $type,
                'quantity' => -$quantity,
                'note' => $note,
                'user_id' => $actor->id,
            ]);

            return $batch;
        });
    }
}
