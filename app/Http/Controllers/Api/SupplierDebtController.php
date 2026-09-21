<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DebtInUseException;
use App\Http\Controllers\Controller;
use App\Models\SupplierDebt;
use Illuminate\Http\Request;

class SupplierDebtController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', SupplierDebt::class);

        $actor = $request->user();

        $query = SupplierDebt::query()->with(['supplier', 'createdByUser'])->withSum('payments', 'amount');

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->integer('supplier_id'));
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', SupplierDebt::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'due_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez enregistrer une dette que pour votre propre boutique.');
        }

        $debt = SupplierDebt::create([...$data, 'created_by' => $actor->id]);

        return response()->json($debt->load(['supplier', 'createdByUser']), 201);
    }

    public function update(Request $request, SupplierDebt $supplierDebt)
    {
        $this->authorize('update', $supplierDebt);

        $data = $request->validate([
            'due_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $supplierDebt->update($data);

        return response()->json($supplierDebt->load(['supplier', 'createdByUser']));
    }

    public function destroy(SupplierDebt $supplierDebt)
    {
        $this->authorize('delete', $supplierDebt);

        if ($supplierDebt->payments()->exists()) {
            throw new DebtInUseException();
        }

        $supplierDebt->delete();

        return response()->json(['message' => 'Dette supprimée.']);
    }

    public function addPayment(Request $request, SupplierDebt $supplierDebt)
    {
        $this->authorize('addPayment', $supplierDebt);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'paid_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($data['amount'] > $supplierDebt->remaining) {
            abort(422, sprintf(
                'Montant trop élevé : il reste %.2f à payer sur cette dette.',
                $supplierDebt->remaining,
            ));
        }

        $supplierDebt->payments()->create([...$data, 'created_by' => $request->user()->id]);

        return response()->json(
            $supplierDebt->fresh(['supplier', 'createdByUser'])->loadSum('payments', 'amount')
        );
    }
}
