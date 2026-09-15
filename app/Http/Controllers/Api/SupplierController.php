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
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(Supplier::create($data), 201);
    }

    public function show(Supplier $supplier)
    {
        return response()->json($supplier);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $this->assertCanManage($request);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'address' => ['nullable', 'string', 'max:255'],
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
