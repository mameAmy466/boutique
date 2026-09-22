<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Exceptions\InvalidDiscountException;
use App\Exceptions\PriceBelowMinimumException;
use App\Models\CashSession;
use App\Models\ProductBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class SaleService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly InvoiceService $invoices,
        private readonly AccountingEntryService $accounting,
    ) {}

    /**
     * @param  array<int, array{product_batch_id: int, quantity: int, unit_price: float}>  $items
     *
     * @throws PriceBelowMinimumException
     * @throws InsufficientStockException
     * @throws InvalidDiscountException
     */
    public function createSale(
        Shop $shop,
        User $cashier,
        CashSession $cashSession,
        array $items,
        string $paymentMethod,
        ?string $customerName = null,
        float $discount = 0,
        float $taxRate = 18.00,
    ): Sale {
        $sale = DB::transaction(function () use ($shop, $cashier, $cashSession, $items, $paymentMethod, $customerName, $discount, $taxRate) {
            $subtotal = 0;
            $totalCost = 0;
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
                $totalCost += round((float) $batch->cost_price * $quantity, 2);

                $lines[] = [
                    'batch' => $batch,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            // A cashier must never grant a discount: only an admin can. And
            // even for an admin, a discount may never push the sale below
            // its total cost — the same "never sell at a loss" guarantee
            // the per-item minimum price already enforces, extended to the
            // whole sale so it can't be undone by discounting afterward.
            if ($discount > 0) {
                if ($cashier->isCashier()) {
                    throw new InvalidDiscountException('Un caissier ne peut pas accorder de remise.');
                }

                $maxDiscount = round($subtotal - $totalCost, 2);
                if ($discount > $maxDiscount) {
                    throw new InvalidDiscountException(sprintf(
                        'Remise trop élevée : maximum autorisé %.2f (la vente ne peut jamais passer sous son coût total).',
                        max($maxDiscount, 0),
                    ));
                }
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
                'tax_rate' => $taxRate,
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

        $this->accounting->recordSale($sale);

        return $sale;
    }

    public function cancelSale(Sale $sale, User $actor, string $reason): Sale
    {
        $sale = DB::transaction(function () use ($sale, $actor, $reason) {
            $sale = Sale::query()->lockForUpdate()->findOrFail($sale->id);

            if ($sale->status !== Sale::STATUS_COMPLETED) {
                throw new RuntimeException('Cette vente ne peut plus être annulée (déjà '.$sale->status.').');
            }

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
                    'note' => 'Annulation de la vente '.$sale->sale_number.' — '.$reason,
                    'user_id' => $actor->id,
                ]);
            }

            $sale->update([
                'status' => Sale::STATUS_CANCELLED,
                'cancellation_reason' => $reason,
                'cancelled_by' => $actor->id,
                'cancelled_at' => now(),
            ]);

            return $sale;
        });

        $this->accounting->recordSaleCancellation($sale);

        return $sale;
    }
}
