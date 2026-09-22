<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\ClientDebt;
use App\Models\ClientDebtItem;
use App\Models\Customer;
use App\Models\ProductBatch;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * A créance client (wholesale credit sale) with product lines behaves like
 * a Sale that just isn't paid yet: stock leaves the shop immediately and
 * the same minimum-price rule applies, only the money comes in later
 * through ClientDebtPayment instead of at the register.
 */
class ClientDebtService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly AccountingEntryService $accounting,
    ) {}

    /**
     * @param  array<int, array{product_batch_id: int, quantity: int, unit_price: float}>  $items
     *
     * @throws \App\Exceptions\PriceBelowMinimumException
     * @throws InsufficientStockException
     */
    public function createWithItems(
        Shop $shop,
        Customer $customer,
        User $actor,
        array $items,
        ?string $dueDate,
        ?string $note,
    ): ClientDebt {
        $debt = DB::transaction(function () use ($shop, $customer, $actor, $items, $dueDate, $note) {
            $amount = 0.0;
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
                $amount += $lineTotal;

                $lines[] = ['batch' => $batch, 'quantity' => $quantity, 'unit_price' => $unitPrice, 'line_total' => $lineTotal];
            }

            $debt = ClientDebt::create([
                'shop_id' => $shop->id,
                'customer_id' => $customer->id,
                'amount' => round($amount, 2),
                'due_date' => $dueDate,
                'note' => $note,
                'created_by' => $actor->id,
            ]);

            $debt->update(['invoice_number' => sprintf('FAC-CR-%d-%06d', now()->year, $debt->id)]);

            foreach ($lines as $line) {
                $batch = $line['batch'];

                ClientDebtItem::create([
                    'client_debt_id' => $debt->id,
                    'product_batch_id' => $batch->id,
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'line_total' => $line['line_total'],
                ]);

                $batch->decrement('quantity_available', $line['quantity']);

                StockMovement::create([
                    'product_batch_id' => $batch->id,
                    'shop_id' => $shop->id,
                    'type' => StockMovement::TYPE_CREDIT_SALE,
                    'quantity' => -$line['quantity'],
                    'reference_type' => ClientDebt::class,
                    'reference_id' => $debt->id,
                    'user_id' => $actor->id,
                ]);
            }

            return $debt->load(['customer', 'createdByUser', 'items.productBatch.product']);
        });

        $this->accounting->recordClientDebtCreated($debt);

        return $debt;
    }
}
