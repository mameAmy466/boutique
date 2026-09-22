<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PurchaseOrderService
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * @param  array<int, array{product_id: int, quantity: int, unit_cost: float}>  $items
     */
    public function createOrder(
        Shop $shop,
        Supplier $supplier,
        User $actor,
        array $items,
        ?string $expectedDate = null,
        ?string $note = null,
    ): PurchaseOrder {
        return DB::transaction(function () use ($shop, $supplier, $actor, $items, $expectedDate, $note) {
            $order = PurchaseOrder::create([
                'shop_id' => $shop->id,
                'supplier_id' => $supplier->id,
                'reference' => 'PENDING',
                'status' => PurchaseOrder::STATUS_ORDERED,
                'expected_date' => $expectedDate,
                'note' => $note,
                'created_by' => $actor->id,
            ]);

            $order->update(['reference' => sprintf('BC-%d-%06d', now()->year, $order->id)]);

            foreach ($items as $item) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'quantity_ordered' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                ]);
            }

            return $order->load('items.product');
        });
    }

    /**
     * @param  array<int, array{purchase_order_item_id: int, quantity: int, additional_costs?: float, min_profit_amount?: float}>  $receipts
     */
    public function receiveItems(PurchaseOrder $order, User $actor, array $receipts): PurchaseOrder
    {
        return DB::transaction(function () use ($order, $actor, $receipts) {
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id);

            if (in_array($order->status, [PurchaseOrder::STATUS_RECEIVED, PurchaseOrder::STATUS_CANCELLED], true)) {
                throw new RuntimeException('Ce bon de commande ne peut plus être réceptionné (déjà '.$order->status.').');
            }

            foreach ($receipts as $receipt) {
                $item = PurchaseOrderItem::query()->lockForUpdate()->findOrFail($receipt['purchase_order_item_id']);

                if ($item->purchase_order_id !== $order->id) {
                    throw new RuntimeException("Cette ligne n'appartient pas à ce bon de commande.");
                }

                $quantity = (int) $receipt['quantity'];
                if ($quantity <= 0) {
                    continue;
                }

                if ($quantity > $item->remaining_quantity) {
                    throw new RuntimeException(sprintf(
                        'Quantité reçue (%d) supérieure à ce qu\'il reste à recevoir (%d) pour %s.',
                        $quantity,
                        $item->remaining_quantity,
                        $item->product->name,
                    ));
                }

                $batch = $this->stock->receiveBatch(
                    product: $item->product,
                    shop: $order->shop,
                    purchaseCost: (float) $item->unit_cost,
                    additionalCosts: (float) ($receipt['additional_costs'] ?? 0),
                    minProfitAmount: (float) ($receipt['min_profit_amount'] ?? 0),
                    quantity: $quantity,
                    receivedBy: $actor,
                    supplierId: $order->supplier_id,
                );
                $batch->update(['purchase_order_item_id' => $item->id]);

                $item->increment('quantity_received', $quantity);
            }

            $order->refresh();
            $items = $order->items;
            $totalOrdered = (int) $items->sum('quantity_ordered');
            $totalReceived = (int) $items->sum('quantity_received');

            $order->update([
                'status' => match (true) {
                    $totalReceived >= $totalOrdered => PurchaseOrder::STATUS_RECEIVED,
                    $totalReceived > 0 => PurchaseOrder::STATUS_PARTIALLY_RECEIVED,
                    default => $order->status,
                },
            ]);

            return $order->load('items.product');
        });
    }

    public function cancel(PurchaseOrder $order): PurchaseOrder
    {
        if ($order->items()->where('quantity_received', '>', 0)->exists()) {
            throw new RuntimeException('Impossible d\'annuler une commande déjà partiellement reçue.');
        }

        $order->update(['status' => PurchaseOrder::STATUS_CANCELLED]);

        return $order;
    }
}
