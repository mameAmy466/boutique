<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Shop;
use App\Models\Supplier;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class PurchaseOrderController extends Controller
{
    public function __construct(private readonly PurchaseOrderService $purchaseOrders) {}

    public function index(Request $request)
    {
        $this->authorize('viewAny', PurchaseOrder::class);

        $actor = $request->user();

        $query = PurchaseOrder::query()->with(['supplier', 'shop', 'createdByUser', 'items.product']);

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', PurchaseOrder::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'expected_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez commander que pour votre propre boutique.');
        }

        $order = $this->purchaseOrders->createOrder(
            shop: Shop::findOrFail($data['shop_id']),
            supplier: Supplier::findOrFail($data['supplier_id']),
            actor: $actor,
            items: $data['items'],
            expectedDate: $data['expected_date'] ?? null,
            note: $data['note'] ?? null,
        );

        return response()->json($order, 201);
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        $this->authorize('view', $purchaseOrder);

        return response()->json($purchaseOrder->load(['supplier', 'shop', 'createdByUser', 'items.product', 'items.batches']));
    }

    public function receive(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorize('receive', $purchaseOrder);

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => ['required', 'exists:purchase_order_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.additional_costs' => ['nullable', 'numeric', 'min:0'],
            'items.*.min_profit_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        try {
            $order = $this->purchaseOrders->receiveItems($purchaseOrder, $request->user(), $data['items']);
        } catch (RuntimeException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json($order);
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorize('cancel', $purchaseOrder);

        try {
            $order = $this->purchaseOrders->cancel($purchaseOrder);
        } catch (RuntimeException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json($order);
    }
}
