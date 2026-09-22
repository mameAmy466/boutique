<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Shop::class);

        $user = $request->user();

        $shops = $user->isSuperAdmin()
            ? Shop::query()->get()
            : Shop::query()->where('id', $user->shop_id)->get();

        return response()->json($shops);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Shop::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:shops,code'],
            'description' => ['nullable', 'string'],
            'manager_name' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'category' => ['nullable', 'string', 'max:100'],
            'monthly_budget' => ['nullable', 'numeric', 'min:0'],
            'sales_target' => ['nullable', 'numeric', 'min:0'],
            'low_stock_alert_threshold' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'in:active,suspended,closed,archived'],
        ]);

        $shop = Shop::create($data);

        return response()->json($shop, 201);
    }

    public function show(Shop $shop)
    {
        $this->authorize('view', $shop);

        return response()->json($shop);
    }

    public function update(Request $request, Shop $shop)
    {
        $this->authorize('update', $shop);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'manager_name' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'category' => ['nullable', 'string', 'max:100'],
            'monthly_budget' => ['nullable', 'numeric', 'min:0'],
            'sales_target' => ['nullable', 'numeric', 'min:0'],
            'low_stock_alert_threshold' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'in:active,suspended,closed,archived'],
        ]);

        $shop->update($data);

        return response()->json($shop);
    }

    public function destroy(Shop $shop)
    {
        $this->authorize('delete', $shop);

        $shop->update(['status' => 'archived']);

        return response()->json(['message' => 'Boutique archivée.']);
    }

    /**
     * Locks every entry, expense and payment dated on or before the given
     * date — a closure can only move forward, never reopen an already
     * closed period.
     */
    public function closePeriod(Request $request, Shop $shop)
    {
        $this->authorize('update', $shop);

        $data = $request->validate([
            'closed_until' => ['required', 'date', 'before_or_equal:today'],
        ]);

        if ($shop->closed_until && $data['closed_until'] <= $shop->closed_until->toDateString()) {
            abort(422, sprintf(
                'La période est déjà clôturée jusqu\'au %s : impossible de revenir en arrière.',
                $shop->closed_until->toDateString(),
            ));
        }

        $shop->update(['closed_until' => $data['closed_until']]);

        return response()->json($shop);
    }
}
