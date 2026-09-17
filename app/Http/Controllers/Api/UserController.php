<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\ProductBatch;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $actor = $request->user();

        $users = $actor->isSuperAdmin()
            ? User::query()->with(['role', 'shop'])->get()
            : User::query()->with(['role', 'shop'])->where('shop_id', $actor->shop_id)->get();

        return response()->json($users);
    }

    public function store(Request $request)
    {
        $this->authorize('create', User::class);

        $actor = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role_id' => ['required', 'exists:roles,id'],
            'shop_id' => ['nullable', 'exists:shops,id'],
        ]);

        // A shop admin may only create cashiers scoped to their own shop.
        if (! $actor->isSuperAdmin()) {
            $data['shop_id'] = $actor->shop_id;
        }

        $user = User::create($data);

        return response()->json($user->load(['role', 'shop']), 201);
    }

    public function show(Request $request, User $user)
    {
        $this->authorize('view', $user);

        return response()->json($user->load(['role', 'shop']));
    }

    public function activity(Request $request, User $user)
    {
        $this->authorize('view', $user);

        $salesCount = Sale::query()
            ->where('user_id', $user->id)
            ->where('status', Sale::STATUS_COMPLETED)
            ->count();
        $salesAmount = (float) Sale::query()
            ->where('user_id', $user->id)
            ->where('status', Sale::STATUS_COMPLETED)
            ->sum('total');

        $stocksCount = ProductBatch::query()->where('received_by', $user->id)->count();
        $stocksAmount = (float) ProductBatch::query()
            ->where('received_by', $user->id)
            ->select(DB::raw('COALESCE(SUM(quantity_received * cost_price), 0) as amount'))
            ->value('amount');

        $openSession = CashSession::query()
            ->with('cashRegister')
            ->where('user_id', $user->id)
            ->where('status', CashSession::STATUS_OPEN)
            ->latest('opened_at')
            ->first();

        $lastSession = $openSession ?? CashSession::query()
            ->with('cashRegister')
            ->where('user_id', $user->id)
            ->latest('opened_at')
            ->first();

        if ($openSession) {
            $cashSales = (float) Sale::query()
                ->where('cash_session_id', $openSession->id)
                ->where('payment_method', 'cash')
                ->where('status', Sale::STATUS_COMPLETED)
                ->sum('total');
            $cashAmount = round((float) $openSession->opening_amount + $cashSales, 2);
        } else {
            $cashAmount = (float) ($lastSession?->expected_amount ?? $lastSession?->closing_amount ?? 0);
        }

        $movementsCount = StockMovement::query()->where('user_id', $user->id)->count();
        $movementsAmount = (float) StockMovement::query()
            ->where('stock_movements.user_id', $user->id)
            ->join('product_batches', 'product_batches.id', '=', 'stock_movements.product_batch_id')
            ->select(DB::raw('COALESCE(SUM(ABS(stock_movements.quantity) * product_batches.cost_price), 0) as amount'))
            ->value('amount');

        $salesRows = Sale::query()
            ->where('user_id', $user->id)
            ->latest()
            ->limit(50)
            ->get(['id', 'sale_number', 'customer_name', 'payment_method', 'status', 'total', 'created_at'])
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'customer_name' => $sale->customer_name,
                'payment_method' => $sale->payment_method,
                'status' => $sale->status,
                'total' => (float) $sale->total,
                'created_at' => $sale->created_at?->toIso8601String(),
            ]);

        $stockRows = ProductBatch::query()
            ->with('product')
            ->where('received_by', $user->id)
            ->latest('received_at')
            ->limit(50)
            ->get()
            ->map(fn (ProductBatch $batch) => [
                'id' => $batch->id,
                'batch_code' => $batch->batch_code,
                'product_name' => $batch->product?->name,
                'quantity' => $batch->quantity_received,
                'amount' => (float) $batch->quantity_received * (float) $batch->cost_price,
                'received_at' => $batch->received_at?->toIso8601String(),
            ]);

        $recentMovements = StockMovement::query()
            ->with(['productBatch' => fn ($q) => $q->withTrashed()->with('product')])
            ->where('user_id', $user->id)
            ->latest()
            ->limit(6)
            ->get()
            ->map(fn (StockMovement $movement) => [
                'id' => $movement->id,
                'type' => $movement->type,
                'quantity' => $movement->quantity,
                'amount' => abs($movement->quantity) * (float) ($movement->productBatch?->cost_price ?? 0),
                'created_at' => $movement->created_at?->toIso8601String(),
                'product_name' => $movement->productBatch?->product?->name,
            ]);

        return response()->json([
            'sales' => [
                'count' => $salesCount,
                'amount' => $salesAmount,
                'rows' => $salesRows,
            ],
            'stocks' => [
                'count' => $stocksCount,
                'amount' => $stocksAmount,
                'rows' => $stockRows,
            ],
            'cash' => [
                'sessions' => CashSession::query()->where('user_id', $user->id)->count(),
                'open' => $openSession !== null,
                'register_name' => $lastSession?->cashRegister?->name,
                'amount' => $cashAmount,
                'opening_amount' => (float) ($lastSession?->opening_amount ?? 0),
            ],
            'movements' => [
                'count' => $movementsCount,
                'amount' => $movementsAmount,
            ],
            'recent_movements' => $recentMovements,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $this->authorize('update', $user);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'role_id' => ['sometimes', 'exists:roles,id'],
            'shop_id' => ['sometimes', 'nullable', 'exists:shops,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $user->update($data);

        return response()->json($user->load(['role', 'shop']));
    }

    public function destroy(Request $request, User $user)
    {
        $this->authorize('delete', $user);

        $user->update(['is_active' => false]);

        return response()->json(['message' => 'Utilisateur désactivé.']);
    }
}
