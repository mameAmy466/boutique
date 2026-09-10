<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Services\CashService;
use Illuminate\Http\Request;

class CashSessionController extends Controller
{
    public function __construct(private readonly CashService $cash) {}

    public function index(Request $request)
    {
        $actor = $request->user();

        $query = CashSession::query()->with(['cashRegister.shop', 'user']);

        if (! $actor->isSuperAdmin()) {
            $query->whereHas('cashRegister', fn ($q) => $q->where('shop_id', $actor->shop_id));
        }

        return response()->json($query->latest()->get());
    }

    public function open(Request $request)
    {
        $this->authorize('open', CashSession::class);

        $data = $request->validate([
            'cash_register_id' => ['required', 'exists:cash_registers,id'],
            'opening_amount' => ['required', 'numeric', 'min:0'],
        ]);

        $register = CashRegister::findOrFail($data['cash_register_id']);
        $actor = $request->user();

        if (! $actor->isSuperAdmin() && $register->shop_id !== $actor->shop_id) {
            abort(403, "Cette caisse n'appartient pas à votre boutique.");
        }

        $session = $this->cash->openSession($register, $actor, $data['opening_amount']);

        return response()->json($session, 201);
    }

    public function close(Request $request, CashSession $cashSession)
    {
        $this->authorize('close', $cashSession);

        $data = $request->validate([
            'declared_amount' => ['required', 'numeric', 'min:0'],
        ]);

        $session = $this->cash->closeSession($cashSession, $data['declared_amount']);

        return response()->json($session);
    }
}
