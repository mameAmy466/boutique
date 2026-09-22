<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

/**
 * Suppliers have no dedicated policy: management rights mirror
 * ProductPolicy's create/update/delete rules (super_admin or shop admin to
 * manage, super_admin only to delete). Those rules are applied directly
 * here rather than via authorize('update', Product::class), which would
 * crash — ProductPolicy::update()/delete() require a Product instance,
 * and there is none in a supplier request.
 */
class SupplierController extends Controller
{
    public function index()
    {
        return response()->json(Supplier::query()->get());
    }

    public function store(Request $request)
    {
        $this->assertCanManage($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'address' => ['nullable', 'string', 'max:255'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0', 'max:365'],
        ]);

        return response()->json(Supplier::create($data), 201);
    }

    public function show(Request $request, Supplier $supplier)
    {
        $actor = $request->user();
        $shopScope = $actor->isSuperAdmin() ? null : $actor->shop_id;

        $debtsQuery = $supplier->debts()->with('createdByUser')->withSum('payments', 'amount');
        if ($shopScope) {
            $debtsQuery->where('shop_id', $shopScope);
        }
        $debts = $debtsQuery->latest()->get();

        return response()->json([
            ...$supplier->toArray(),
            'debts' => $debts,
            'total_debt' => round((float) $debts->sum('remaining'), 2),
            'consolidated' => $shopScope === null,
        ]);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $this->assertCanManage($request);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'address' => ['nullable', 'string', 'max:255'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0', 'max:365'],
        ]);

        $supplier->update($data);

        return response()->json($supplier);
    }

    public function destroy(Request $request, Supplier $supplier)
    {
        if (! $request->user()->isSuperAdmin()) {
            abort(403, "Seul l'administrateur général peut supprimer un fournisseur.");
        }

        $supplier->delete();

        return response()->json(['message' => 'Fournisseur supprimé.']);
    }

    private function assertCanManage(Request $request): void
    {
        $user = $request->user();

        if (! $user->isSuperAdmin() && ! $user->isShopAdmin()) {
            abort(403, 'Action réservée aux administrateurs.');
        }
    }
}
