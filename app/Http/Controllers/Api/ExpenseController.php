<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Sale;
use App\Models\Shop;
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

        $query = Expense::query()->with(['createdByUser', 'employee']);

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
            'employee_id' => ['nullable', 'exists:employees,id', Rule::requiredIf($request->input('category') === 'salaires')],
            'label' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', Rule::in(Sale::PAYMENT_METHODS)],
            'expense_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez enregistrer une dépense que pour votre propre boutique.');
        }

        $this->assertEmployeeLinkIsValid($data);

        $shop = Shop::findOrFail($data['shop_id']);
        if ($shop->isDateLocked($data['expense_date'])) {
            abort(422, sprintf('Période comptable clôturée jusqu\'au %s.', $shop->closed_until->toDateString()));
        }

        $expense = Expense::create([...$data, 'payment_method' => $data['payment_method'] ?? 'cash', 'created_by' => $actor->id]);

        $this->accounting->recordExpense($expense);

        return response()->json($expense->load(['createdByUser', 'employee']), 201);
    }

    public function update(Request $request, Expense $expense)
    {
        $this->authorize('update', $expense);

        $data = $request->validate([
            'category' => ['sometimes', Rule::in(Expense::CATEGORIES)],
            'employee_id' => ['nullable', 'exists:employees,id'],
            'label' => ['nullable', 'string', 'max:255'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'payment_method' => ['sometimes', Rule::in(Sale::PAYMENT_METHODS)],
            'expense_date' => ['sometimes', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->assertEmployeeLinkIsValid([
            'shop_id' => $expense->shop_id,
            'category' => $data['category'] ?? $expense->category,
            'employee_id' => array_key_exists('employee_id', $data) ? $data['employee_id'] : $expense->employee_id,
        ]);

        $shop = $expense->shop;
        $newDate = $data['expense_date'] ?? $expense->expense_date->toDateString();
        if ($shop->isDateLocked($expense->expense_date->toDateString()) || $shop->isDateLocked($newDate)) {
            abort(422, sprintf('Période comptable clôturée jusqu\'au %s.', $shop->closed_until->toDateString()));
        }

        $expense->update($data);

        return response()->json($expense->load(['createdByUser', 'employee']));
    }

    public function destroy(Expense $expense)
    {
        $this->authorize('delete', $expense);

        if ($expense->shop->isDateLocked($expense->expense_date->toDateString())) {
            abort(422, sprintf('Période comptable clôturée jusqu\'au %s.', $expense->shop->closed_until->toDateString()));
        }

        $expense->delete();

        return response()->json(['message' => 'Dépense supprimée.']);
    }

    /**
     * A salary payment must reference a real employee of the same shop, and
     * only a salary payment may reference one — keeps the two concepts from
     * drifting apart as expenses evolve. Called with the *effective* values
     * (already merged with the existing record on update), so it also
     * catches a category change away from "salaires" that would otherwise
     * strand a stale employee_id, or one into it without an employee.
     */
    private function assertEmployeeLinkIsValid(array $data): void
    {
        $isSalaryCategory = ($data['category'] ?? null) === 'salaires';

        if ($isSalaryCategory && empty($data['employee_id'])) {
            abort(422, 'Indique l\'employé concerné par ce paiement de salaire.');
        }

        if (empty($data['employee_id'])) {
            return;
        }

        if (! $isSalaryCategory) {
            abort(422, "Un employé ne peut être rattaché qu'à une dépense de catégorie « Salaires ».");
        }

        $employee = Employee::find($data['employee_id']);
        if (! $employee || $employee->shop_id !== (int) $data['shop_id']) {
            abort(422, "Cet employé n'appartient pas à cette boutique.");
        }
    }
}
