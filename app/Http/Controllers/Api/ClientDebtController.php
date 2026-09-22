<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DebtInUseException;
use App\Http\Controllers\Controller;
use App\Models\ClientDebt;
use App\Models\Sale;
use App\Services\AccountingEntryService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientDebtController extends Controller
{
    public function __construct(private readonly AccountingEntryService $accounting) {}

    public function index(Request $request)
    {
        $this->authorize('viewAny', ClientDebt::class);

        $actor = $request->user();

        $query = ClientDebt::query()->with(['customer', 'createdByUser'])->withSum('payments', 'amount');

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->integer('customer_id'));
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', ClientDebt::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'customer_id' => ['required', 'exists:customers,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'due_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez enregistrer une créance que pour votre propre boutique.');
        }

        $debt = ClientDebt::create([...$data, 'created_by' => $actor->id]);

        $this->accounting->recordClientDebtCreated($debt);

        return response()->json($debt->load(['customer', 'createdByUser']), 201);
    }

    public function update(Request $request, ClientDebt $clientDebt)
    {
        $this->authorize('update', $clientDebt);

        $data = $request->validate([
            'due_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $clientDebt->update($data);

        return response()->json($clientDebt->load(['customer', 'createdByUser']));
    }

    public function destroy(ClientDebt $clientDebt)
    {
        $this->authorize('delete', $clientDebt);

        if ($clientDebt->payments()->exists()) {
            throw new DebtInUseException();
        }

        $clientDebt->delete();

        return response()->json(['message' => 'Créance supprimée.']);
    }

    public function addPayment(Request $request, ClientDebt $clientDebt)
    {
        $this->authorize('addPayment', $clientDebt);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', Rule::in(Sale::PAYMENT_METHODS)],
            'paid_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($data['amount'] > $clientDebt->remaining) {
            abort(422, sprintf(
                'Montant trop élevé : il reste %.2f à recevoir sur cette créance.',
                $clientDebt->remaining,
            ));
        }

        $payment = $clientDebt->payments()->create([
            ...$data,
            'payment_method' => $data['payment_method'] ?? 'cash',
            'created_by' => $request->user()->id,
        ]);

        $this->accounting->recordClientDebtPayment($payment);

        return response()->json(
            $clientDebt->fresh(['customer', 'createdByUser'])->loadSum('payments', 'amount')
        );
    }
}
