<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Shop;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct(private readonly SubscriptionService $subscriptions) {}

    public function general(Request $request)
    {
        $this->authorize('viewAny', Shop::class);

        $actor = $request->user();
        if (! $actor->isSuperAdmin()) {
            abort(403, 'Réservé à l\'administrateur général.');
        }

        $shopIds = Shop::where('organization_id', $actor->organization_id)->pluck('id');

        return response()->json([
            'revenue' => $this->revenueFigures(null, $shopIds),
            'gross_profit' => $this->grossProfit(null, $shopIds),
            'shops' => [
                'total' => $shopIds->count(),
                'active' => Shop::whereIn('id', $shopIds)->where('status', 'active')->count(),
            ],
            'stock' => $this->stockFigures(null, $shopIds),
            'cash_sessions' => [
                'open' => CashSession::whereHas('cashRegister', fn ($q) => $q->whereIn('shop_id', $shopIds))
                    ->where('status', 'open')->count(),
            ],
            'alerts' => $this->alertCounts(null, $shopIds),
            'sales_trend' => $this->salesTrend(null, $shopIds),
            'top_products' => $this->topProducts(null, $shopIds),
            // Comparing shops against each other is the one piece of this
            // dashboard the pricing grid reserves for Pro Max — Simple/Pro
            // organizations still get every other figure above, scoped to
            // their own (single) shop.
            'shops_comparison' => $this->subscriptions->hasFeature($actor->organization, 'multi_shop_dashboard')
                ? $this->shopsComparison($shopIds)
                : [],
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
            'sales_trend' => $this->salesTrend($shop->id),
            'top_products' => $this->topProducts($shop->id),
        ]);
    }

    /**
     * Every private figure below takes either a single $shopId (the
     * per-shop dashboard) or a $shopIds collection (the organization-wide
     * dashboard) — never both, and never neither once organizations exist,
     * so a query with no filter at all can no longer silently span every
     * organization in the database.
     */
    private function revenueFigures(?int $shopId = null, $shopIds = null): array
    {
        $query = fn ($from) => Sale::query()
            ->where('status', Sale::STATUS_COMPLETED)
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
            ->when(! $shopId && $shopIds !== null, fn ($q) => $q->whereIn('shop_id', $shopIds))
            ->where('created_at', '>=', $from)
            ->sum('total');

        return [
            'today' => $query(now()->startOfDay()),
            'this_week' => $query(now()->startOfWeek()),
            'this_month' => $query(now()->startOfMonth()),
            'this_year' => $query(now()->startOfYear()),
        ];
    }

    private function grossProfit(?int $shopId = null, $shopIds = null): float
    {
        return (float) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', Sale::STATUS_COMPLETED)
            ->when($shopId, fn ($q) => $q->where('sales.shop_id', $shopId))
            ->when(! $shopId && $shopIds !== null, fn ($q) => $q->whereIn('sales.shop_id', $shopIds))
            ->select(DB::raw('COALESCE(SUM(sale_items.line_total - (sale_items.cost_price * sale_items.quantity)), 0) as profit'))
            ->value('profit');
    }

    private function stockFigures(?int $shopId = null, $shopIds = null): array
    {
        $batches = ProductBatch::query()
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
            ->when(! $shopId && $shopIds !== null, fn ($q) => $q->whereIn('shop_id', $shopIds));

        return [
            'value' => (float) (clone $batches)->select(
                DB::raw('COALESCE(SUM(quantity_available * cost_price), 0) as value')
            )->value('value'),
            'out_of_stock_batches' => (clone $batches)->where('quantity_available', 0)->count(),
        ];
    }

    private function alertCounts(?int $shopId = null, $shopIds = null): array
    {
        $scope = function ($q) use ($shopId, $shopIds) {
            $q->when($shopId, fn ($qq) => $qq->where('shop_id', $shopId))
                ->when(! $shopId && $shopIds !== null, fn ($qq) => $qq->whereIn('shop_id', $shopIds));
        };

        $lowStock = Product::query()
            ->whereHas('batches', $scope)
            ->get()
            ->filter(function (Product $product) use ($shopId, $shopIds) {
                $available = $product->batches()
                    ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
                    ->when(! $shopId && $shopIds !== null, fn ($q) => $q->whereIn('shop_id', $shopIds))
                    ->sum('quantity_available');

                return $available <= $product->min_stock;
            })
            ->count();

        $outOfStock = Product::query()
            ->whereHas('batches', $scope)
            ->whereDoesntHave('batches', function ($q) use ($scope) {
                $scope($q);
                $q->where('quantity_available', '>', 0);
            })
            ->count();

        return [
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
        ];
    }

    /**
     * Daily revenue for the last 14 days (including days with no sales).
     */
    private function salesTrend(?int $shopId = null, $shopIds = null): array
    {
        $from = now()->subDays(13)->startOfDay();

        $rows = Sale::query()
            ->where('status', Sale::STATUS_COMPLETED)
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
            ->when(! $shopId && $shopIds !== null, fn ($q) => $q->whereIn('shop_id', $shopIds))
            ->where('created_at', '>=', $from)
            ->select(DB::raw('DATE(created_at) as day'), DB::raw('SUM(total) as total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $trend = [];
        for ($i = 0; $i < 14; $i++) {
            $date = $from->copy()->addDays($i)->toDateString();
            $trend[] = [
                'date' => $date,
                'total' => (float) ($rows[$date] ?? 0),
            ];
        }

        return $trend;
    }

    /**
     * Top 5 products by revenue (completed sales only).
     */
    private function topProducts(?int $shopId = null, $shopIds = null): array
    {
        return SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('product_batches', 'product_batches.id', '=', 'sale_items.product_batch_id')
            ->join('products', 'products.id', '=', 'product_batches.product_id')
            ->where('sales.status', Sale::STATUS_COMPLETED)
            ->when($shopId, fn ($q) => $q->where('sales.shop_id', $shopId))
            ->when(! $shopId && $shopIds !== null, fn ($q) => $q->whereIn('sales.shop_id', $shopIds))
            ->select(
                'products.id as product_id',
                'products.name',
                DB::raw('SUM(sale_items.quantity) as quantity'),
                DB::raw('SUM(sale_items.line_total) as revenue'),
            )
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id,
                'name' => $row->name,
                'quantity' => (int) $row->quantity,
                'revenue' => (float) $row->revenue,
            ])
            ->all();
    }

    /**
     * This month's revenue and profit per active shop, within the given
     * organization's shops — a Pro Max feature (see general()).
     */
    private function shopsComparison($shopIds): array
    {
        $from = now()->startOfMonth();

        $revenueByShop = Sale::query()
            ->whereIn('shop_id', $shopIds)
            ->where('status', Sale::STATUS_COMPLETED)
            ->where('created_at', '>=', $from)
            ->groupBy('shop_id')
            ->select('shop_id', DB::raw('SUM(total) as revenue'))
            ->pluck('revenue', 'shop_id');

        $profitByShop = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereIn('sales.shop_id', $shopIds)
            ->where('sales.status', Sale::STATUS_COMPLETED)
            ->where('sales.created_at', '>=', $from)
            ->groupBy('sales.shop_id')
            ->select('sales.shop_id', DB::raw('SUM(sale_items.line_total - (sale_items.cost_price * sale_items.quantity)) as profit'))
            ->pluck('profit', 'shop_id');

        return Shop::query()
            ->whereIn('id', $shopIds)
            ->where('status', 'active')
            ->get(['id', 'name'])
            ->map(fn ($shop) => [
                'shop_id' => $shop->id,
                'name' => $shop->name,
                'revenue' => (float) ($revenueByShop[$shop->id] ?? 0),
                'profit' => (float) ($profitByShop[$shop->id] ?? 0),
            ])
            ->all();
    }
}
