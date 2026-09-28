<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use App\Models\Shop;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

class CashRegisterController extends Controller
{
    public function __construct(private readonly SubscriptionService $subscriptions) {}

    public function index(Request $request)
    {
        $actor = $request->user();

        $query = CashRegister::query();

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        } else {
            $query->whereHas('shop', fn ($q) => $q->where('organization_id', $actor->organization_id));
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

        $shop = Shop::findOrFail($data['shop_id']);

        if ($actor->isSuperAdmin() && $shop->organization_id !== $actor->organization_id) {
            abort(422, "Cette boutique n'appartient pas à votre organisation.");
        }

        $currentRegisterCount = CashRegister::whereHas('shop', fn ($q) => $q->where('organization_id', $shop->organization_id))->count();
        $this->subscriptions->assertWithinLimit(
            $shop->organization,
            'max_registers',
            $currentRegisterCount,
            'Limite de caisses de votre abonnement atteinte. Passez à un forfait supérieur ou ajoutez une caisse en option.',
        );

        $register = CashRegister::create($data);

        return response()->json($register, 201);
    }
}
