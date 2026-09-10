<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\Sale;
use App\Models\Shop;
use App\Services\SaleService;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function __construct(private readonly SaleService $sales) {}

    public function index(Request $request)
    {
        $actor = $request->user();

        $query = Sale::query()->with(['items', 'invoice', 'user']);

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        return response()->json($query->latest()->paginate(50));
    }

    public function store(Request $request)
    {
        $this->authorize('create', Sale::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'cash_session_id' => ['required', 'exists:cash_sessions,id'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['required', 'in:cash,card,wave,orange_money,free_money,transfer,other'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_batch_id' => ['required', 'exists:product_batches,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez vendre que dans votre propre boutique.');
        }

        $cashSession = CashSession::findOrFail($data['cash_session_id']);

        if (! $cashSession->isOpen() || $cashSession->user_id !== $actor->id) {
            abort(422, 'Aucune session de caisse ouverte pour cet utilisateur.');
        }

        $sale = $this->sales->createSale(
            shop: Shop::findOrFail($data['shop_id']),
            cashier: $actor,
            cashSession: $cashSession,
            items: $data['items'],
            paymentMethod: $data['payment_method'],
            customerName: $data['customer_name'] ?? null,
            discount: $data['discount'] ?? 0,
        );

        return response()->json($sale, 201);
    }

    public function show(Sale $sale)
    {
        $this->authorize('view', $sale);

        return response()->json($sale->load(['items.productBatch.product', 'invoice', 'user']));
    }

    public function cancel(Request $request, Sale $sale)
    {
        $this->authorize('cancel', $sale);

        $sale = $this->sales->cancelSale($sale, $request->user());

        return response()->json($sale);
    }
}
