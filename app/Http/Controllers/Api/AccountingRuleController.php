<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingRule;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountingRuleController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', AccountingRule::class);

        return response()->json(
            AccountingRule::query()->with(['debitAccount', 'creditAccount', 'journal'])->orderBy('event')->orderBy('category')->get()
        );
    }

    public function store(Request $request)
    {
        $this->authorize('create', AccountingRule::class);

        $data = $this->validated($request);

        if (AccountingRule::where('event', $data['event'])->where('category', $data['category'] ?? null)->exists()) {
            abort(422, 'Une règle existe déjà pour cet événement'.(($data['category'] ?? null) ? ' et cette catégorie' : '').'.');
        }

        $rule = AccountingRule::create($data);

        return response()->json($rule->load(['debitAccount', 'creditAccount', 'journal']), 201);
    }

    public function update(Request $request, AccountingRule $accountingRule)
    {
        $this->authorize('update', $accountingRule);

        $data = $this->validated($request);

        $rule = AccountingRule::where('event', $data['event'])
            ->where('category', $data['category'] ?? null)
            ->where('id', '!=', $accountingRule->id)
            ->exists();

        if ($rule) {
            abort(422, 'Une règle existe déjà pour cet événement'.(($data['category'] ?? null) ? ' et cette catégorie' : '').'.');
        }

        $accountingRule->update($data);

        return response()->json($accountingRule->load(['debitAccount', 'creditAccount', 'journal']));
    }

    public function destroy(AccountingRule $accountingRule)
    {
        $this->authorize('delete', $accountingRule);

        $accountingRule->delete();

        return response()->json(['message' => 'Règle supprimée.']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'event' => ['required', Rule::in(AccountingRule::EVENTS)],
            'category' => ['nullable', 'string', Rule::in(Expense::CATEGORIES)],
            'dynamic_leg' => ['nullable', Rule::in(['debit', 'credit'])],
            'dynamic_journal' => ['sometimes', 'boolean'],
            'debit_account_id' => ['nullable', 'exists:accounts,id'],
            'credit_account_id' => ['nullable', 'exists:accounts,id'],
            'journal_id' => ['nullable', 'exists:accounting_journals,id'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($data['event'] !== 'expense') {
            $data['category'] = null;
        }

        return $data;
    }
}
