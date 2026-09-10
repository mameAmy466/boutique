<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Http\Request;

class StockController extends Controller
{
    public function __construct(private readonly StockService $stock) {}

    public function index(Request $request)
    {
        $actor = $request->user();

        $query = ProductBatch::query()->with(['product', 'shop', 'supplier']);

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->integer('product_id'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', ProductBatch::class);

        $actor = $request->user();

        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'shop_id' => ['required', 'exists:shops,id'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'purchase_cost' => ['required', 'numeric', 'min:0'],
            'additional_costs' => ['nullable', 'numeric', 'min:0'],
            'min_profit_amount' => ['required', 'numeric', 'min:0'],
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez réceptionner du stock que pour votre propre boutique.');
        }

        $batch = $this->stock->receiveBatch(
            product: Product::findOrFail($data['product_id']),
            shop: Shop::findOrFail($data['shop_id']),
            purchaseCost: $data['purchase_cost'],
            additionalCosts: $data['additional_costs'] ?? 0,
            minProfitAmount: $data['min_profit_amount'],
            quantity: $data['quantity'],
            receivedBy: $actor,
            supplierId: $data['supplier_id'] ?? null,
        );

        return response()->json($batch, 201);
    }

    public function adjust(Request $request, ProductBatch $batch)
    {
        $this->authorize('adjust', $batch);

        $data = $request->validate([
            'physical_quantity' => ['required', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $batch = $this->stock->adjustToPhysicalCount(
            $batch,
            $data['physical_quantity'],
            $data['reason'],
            $request->user(),
        );

        return response()->json($batch);
    }

    public function shrinkage(Request $request, ProductBatch $batch)
    {
        $this->authorize('adjust', $batch);

        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1'],
            'type' => ['required', 'in:damage,loss,theft,expiration'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $batch = $this->stock->recordShrinkage(
            $batch,
            $data['quantity'],
            $data['type'],
            $data['note'] ?? null,
            $request->user(),
        );

        return response()->json($batch);
    }

    public function movements(Request $request)
    {
        $actor = $request->user();

        $query = StockMovement::query()->with(['productBatch.product', 'shop', 'user']);

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        return response()->json($query->latest()->paginate(50));
    }
}
