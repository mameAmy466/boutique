<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DebtInUseException;
use App\Http\Controllers\Controller;
use App\Models\ClientDebt;
use App\Models\Customer;
use App\Models\ProductBatch;
use App\Models\Sale;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Services\AccountingEntryService;
use App\Services\ClientDebtService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClientDebtController extends Controller
{
    public function __construct(
        private readonly AccountingEntryService $accounting,
        private readonly ClientDebtService $clientDebts,
    ) {}

    public function index(Request $request)
    {
        $this->authorize('viewAny', ClientDebt::class);

        $actor = $request->user();

        $query = ClientDebt::query()
            ->with(['customer', 'createdByUser', 'items.productBatch.product'])
            ->withSum('payments', 'amount');

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
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'due_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.product_batch_id' => ['required_with:items', 'exists:product_batches,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez enregistrer une créance que pour votre propre boutique.');
        }

        if (empty($data['items']) && empty($data['amount'])) {
            abort(422, 'Indiquez les produits vendus ou, à défaut, un montant.');
        }

        $customer = Customer::findOrFail($data['customer_id']);

        $incomingAmount = ! empty($data['items'])
            ? collect($data['items'])->sum(fn ($item) => $item['quantity'] * $item['unit_price'])
            : (float) $data['amount'];

        if ($customer->credit_limit !== null) {
            $currentDebt = $customer->totalDebt();
            if ($currentDebt + $incomingAmount > (float) $customer->credit_limit) {
                abort(422, sprintf(
                    'Plafond de crédit dépassé : %s doit déjà %s FCFA sur un plafond de %s FCFA.',
                    $customer->name,
                    number_format($currentDebt, 0, ',', ' '),
                    number_format((float) $customer->credit_limit, 0, ',', ' '),
                ));
            }
        }

        if (! empty($data['items'])) {
            $debt = $this->clientDebts->createWithItems(
                shop: Shop::findOrFail($data['shop_id']),
                customer: $customer,
                actor: $actor,
                items: $data['items'],
                dueDate: $data['due_date'] ?? null,
                note: $data['note'] ?? null,
            );
        } else {
            $debt = ClientDebt::create([
                'shop_id' => $data['shop_id'],
                'customer_id' => $data['customer_id'],
                'amount' => $data['amount'],
                'due_date' => $data['due_date'] ?? null,
                'note' => $data['note'] ?? null,
                'created_by' => $actor->id,
            ]);
            $debt->update(['invoice_number' => sprintf('FAC-CR-%d-%06d', now()->year, $debt->id)]);

            $this->accounting->recordClientDebtCreated($debt);
        }

        return response()->json($debt->load(['customer', 'createdByUser', 'items.productBatch.product']), 201);
    }

    public function update(Request $request, ClientDebt $clientDebt)
    {
        $this->authorize('update', $clientDebt);

        $data = $request->validate([
            'due_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $clientDebt->update($data);

        return response()->json($clientDebt->load(['customer', 'createdByUser', 'items.productBatch.product']));
    }

    public function destroy(Request $request, ClientDebt $clientDebt)
    {
        $this->authorize('delete', $clientDebt);

        if ($clientDebt->payments()->exists()) {
            throw new DebtInUseException();
        }

        DB::transaction(function () use ($clientDebt, $request) {
            foreach ($clientDebt->items as $item) {
                $batch = ProductBatch::query()->lockForUpdate()->find($item->product_batch_id);
                if (! $batch) {
                    continue;
                }

                $batch->increment('quantity_available', $item->quantity);

                StockMovement::create([
                    'product_batch_id' => $batch->id,
                    'shop_id' => $clientDebt->shop_id,
                    'type' => StockMovement::TYPE_RETURN,
                    'quantity' => $item->quantity,
                    'reference_type' => ClientDebt::class,
                    'reference_id' => $clientDebt->id,
                    'note' => 'Annulation de la créance '.($clientDebt->invoice_number ?? '#'.$clientDebt->id),
                    'user_id' => $request->user()->id,
                ]);
            }

            $clientDebt->delete();
        });

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

        if ($clientDebt->shop->isDateLocked($data['paid_at'])) {
            abort(422, sprintf('Période comptable clôturée jusqu\'au %s.', $clientDebt->shop->closed_until->toDateString()));
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
