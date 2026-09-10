<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Shop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function general(Request $request)
    {
        $this->authorize('viewAny', Shop::class);

        if (! $request->user()->isSuperAdmin()) {
            abort(403, 'Réservé à l\'administrateur général.');
        }

        return response()->json([
            'revenue' => $this->revenueFigures(),
            'gross_profit' => $this->grossProfit(),
            'shops' => [
                'total' => Shop::count(),
                'active' => Shop::where('status', 'active')->count(),
            ],
            'stock' => $this->stockFigures(),
            'cash_sessions' => [
                'open' => CashSession::where('status', 'open')->count(),
            ],
            'alerts' => $this->alertCounts(),
        ]);
    }

    public function shop(Request $request, Shop $shop)
    {
        $this->authorize('view', $shop);

        return response()->json([
            'shop' => $shop->only(['id', 'name', 'code']),
            'revenue' => $this->revenueFigures($shop->id),
            'gross_profit' => $this->grossProfit($shop->id),
            'stock' => $this->stockFigures($shop->id),
            'cash_sessions' => [
                'open' => CashSession::whereHas('cashRegister', fn ($q) => $q->where('shop_id', $shop->id))
                    ->where('status', 'open')->count(),
            ],
            'alerts' => $this->alertCounts($shop->id),
        ]);
    }

    private function revenueFigures(?int $shopId = null): array
    {
        $query = fn ($from) => Sale::query()
            ->where('status', Sale::STATUS_COMPLETED)
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
            ->where('created_at', '>=', $from)
            ->sum('total');

        return [
            'today' => $query(now()->startOfDay()),
            'this_week' => $query(now()->startOfWeek()),
            'this_month' => $query(now()->startOfMonth()),
            'this_year' => $query(now()->startOfYear()),
        ];
    }

    private function grossProfit(?int $shopId = null): float
    {
        return (float) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', Sale::STATUS_COMPLETED)
            ->when($shopId, fn ($q) => $q->where('sales.shop_id', $shopId))
            ->select(DB::raw('COALESCE(SUM(sale_items.line_total - (sale_items.cost_price * sale_items.quantity)), 0) as profit'))
            ->value('profit');
    }

    private function stockFigures(?int $shopId = null): array
    {
        $batches = ProductBatch::query()
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId));

        return [
            'value' => (float) (clone $batches)->select(
                DB::raw('COALESCE(SUM(quantity_available * cost_price), 0) as value')
            )->value('value'),
            'out_of_stock_batches' => (clone $batches)->where('quantity_available', 0)->count(),
        ];
    }

    private function alertCounts(?int $shopId = null): array
    {
        $lowStock = Product::query()
            ->whereHas('batches', function ($q) use ($shopId) {
                $q->when($shopId, fn ($qq) => $qq->where('shop_id', $shopId));
            })
            ->get()
            ->filter(function (Product $product) use ($shopId) {
                $available = $product->batches()
                    ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
                    ->sum('quantity_available');

                return $available <= $product->min_stock;
            })
            ->count();

        return [
            'low_stock' => $lowStock,
        ];
    }
}
