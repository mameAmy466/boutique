<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Exceptions\PriceBelowMinimumException;
use App\Models\CashSession;
use App\Models\ProductBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SaleService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly InvoiceService $invoices,
    ) {}

    /**
     * @param  array<int, array{product_batch_id: int, quantity: int, unit_price: float}>  $items
     *
     * @throws PriceBelowMinimumException
     * @throws InsufficientStockException
     */
    public function createSale(
        Shop $shop,
        User $cashier,
        CashSession $cashSession,
        array $items,
        string $paymentMethod,
        ?string $customerName = null,
        float $discount = 0,
    ): Sale {
        return DB::transaction(function () use ($shop, $cashier, $cashSession, $items, $paymentMethod, $customerName, $discount) {
            $subtotal = 0;
            $lines = [];

            foreach ($items as $item) {
                $batch = ProductBatch::query()
                    ->where('shop_id', $shop->id)
                    ->lockForUpdate()
                    ->findOrFail($item['product_batch_id']);

                $quantity = (int) $item['quantity'];
                $unitPrice = (float) $item['unit_price'];

                if ($batch->quantity_available < $quantity) {
                    throw new InsufficientStockException($batch->quantity_available, $quantity);
                }

                // Server-side enforcement: never trust a client-side check.
                $this->pricing->assertValidSalePrice($batch, $unitPrice);

                $lineTotal = round($unitPrice * $quantity, 2);
                $subtotal += $lineTotal;

                $lines[] = [
                    'batch' => $batch,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            $total = round($subtotal - $discount, 2);

            $sale = Sale::create([
                'sale_number' => 'PENDING',
                'shop_id' => $shop->id,
                'user_id' => $cashier->id,
                'cash_session_id' => $cashSession->id,
                'customer_name' => $customerName,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'payment_method' => $paymentMethod,
                'status' => Sale::STATUS_COMPLETED,
            ]);

            $sale->update([
                'sale_number' => sprintf('VTE-%d-%06d', now()->year, $sale->id),
            ]);

            foreach ($lines as $line) {
                $batch = $line['batch'];

                SaleItem::create([
                    'sale_id' => $sale->id,
                    'product_batch_id' => $batch->id,
                    'quantity' => $line['quantity'],
                    'cost_price' => $batch->cost_price,
                    'min_price' => $batch->min_price,
                    'unit_price' => $line['unit_price'],
                    'line_total' => $line['line_total'],
                ]);

                $batch->decrement('quantity_available', $line['quantity']);

                StockMovement::create([
                    'product_batch_id' => $batch->id,
                    'shop_id' => $shop->id,
                    'type' => StockMovement::TYPE_SALE,
                    'quantity' => -$line['quantity'],
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                    'user_id' => $cashier->id,
                ]);
            }

            $this->invoices->generateForSale($sale);

            return $sale->load(['items', 'invoice']);
        });
    }

    public function cancelSale(Sale $sale, User $actor): Sale
    {
        return DB::transaction(function () use ($sale, $actor) {
            $sale = Sale::query()->lockForUpdate()->findOrFail($sale->id);

            foreach ($sale->items as $item) {
                $batch = ProductBatch::query()->lockForUpdate()->findOrFail($item->product_batch_id);
                $batch->increment('quantity_available', $item->quantity);

                StockMovement::create([
                    'product_batch_id' => $batch->id,
                    'shop_id' => $sale->shop_id,
                    'type' => StockMovement::TYPE_RETURN,
                    'quantity' => $item->quantity,
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                    'note' => 'Annulation de la vente '.$sale->sale_number,
                    'user_id' => $actor->id,
                ]);
            }

            $sale->update(['status' => Sale::STATUS_CANCELLED]);

            return $sale;
        });
    }
}
