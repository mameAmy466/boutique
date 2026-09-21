<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $actor = $request->user();

        $query = Customer::query();

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('search')) {
            $needle = $request->string('search');
            $query->where(function ($q) use ($needle) {
                $q->where('name', 'like', "%{$needle}%")
                    ->orWhere('phone', 'like', "%{$needle}%");
            });
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $actor = $request->user();

        if (! $actor->isSuperAdmin() && ! $actor->isShopAdmin()) {
            abort(403, 'Action réservée aux administrateurs.');
        }

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez créer un client que pour votre propre boutique.');
        }

        return response()->json(Customer::create($data), 201);
    }

    public function update(Request $request, Customer $customer)
    {
        $actor = $request->user();

        if (! $actor->isSuperAdmin() && ! ($actor->isShopAdmin() && $actor->shop_id === $customer->shop_id)) {
            abort(403, 'Action réservée aux administrateurs de cette boutique.');
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $customer->update($data);

        return response()->json($customer);
    }
}
