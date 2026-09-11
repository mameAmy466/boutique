<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use Illuminate\Http\Request;

class CashRegisterController extends Controller
{
    public function index(Request $request)
    {
        $actor = $request->user();

        $query = CashRegister::query();

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $actor = $request->user();

        if (! $actor->isSuperAdmin() && ! $actor->isShopAdmin()) {
            abort(403, "Vous n'êtes pas autorisé à créer une caisse.");
        }

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez créer une caisse que pour votre propre boutique.');
        }

        $register = CashRegister::create($data);

        return response()->json($register, 201);
    }
}
