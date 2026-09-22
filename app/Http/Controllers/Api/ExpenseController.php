<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Sale;
use App\Services\AccountingEntryService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    public function __construct(private readonly AccountingEntryService $accounting) {}

    public function index(Request $request)
    {
        $this->authorize('viewAny', Expense::class);

        $actor = $request->user();

        $query = Expense::query()->with('createdByUser');

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('from')) {
            $query->where('expense_date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->where('expense_date', '<=', $request->date('to'));
        }

        return response()->json($query->latest('expense_date')->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', Expense::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'category' => ['required', Rule::in(Expense::CATEGORIES)],
            'label' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', Rule::in(Sale::PAYMENT_METHODS)],
            'expense_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez enregistrer une dépense que pour votre propre boutique.');
        }

        $expense = Expense::create([...$data, 'payment_method' => $data['payment_method'] ?? 'cash', 'created_by' => $actor->id]);

        $this->accounting->recordExpense($expense);

        return response()->json($expense->load('createdByUser'), 201);
    }

    public function update(Request $request, Expense $expense)
    {
        $this->authorize('update', $expense);

        $data = $request->validate([
            'category' => ['sometimes', Rule::in(Expense::CATEGORIES)],
            'label' => ['nullable', 'string', 'max:255'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'payment_method' => ['sometimes', Rule::in(Sale::PAYMENT_METHODS)],
            'expense_date' => ['sometimes', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $expense->update($data);

        return response()->json($expense->load('createdByUser'));
    }

    public function destroy(Expense $expense)
    {
        $this->authorize('delete', $expense);

        $expense->delete();

        return response()->json(['message' => 'Dépense supprimée.']);
    }
}
