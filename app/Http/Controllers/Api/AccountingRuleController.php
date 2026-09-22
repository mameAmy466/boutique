<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
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

    /**
     * Every (event, category) combination the accounting engine can fire,
     * marked configured or not — the "événements sans règle configurée"
     * dashboard.
     */
    public function coverage()
    {
        $this->authorize('viewAny', AccountingRule::class);

        $expected = [];
        foreach (AccountingRule::EVENTS as $event) {
            if ($event === 'expense') {
                foreach (Expense::CATEGORIES as $category) {
                    $expected[] = ['event' => $event, 'category' => $category];
                }
            } else {
                $expected[] = ['event' => $event, 'category' => null];
            }
        }

        $existing = AccountingRule::query()->get(['event', 'category'])
            ->mapWithKeys(fn ($r) => [$r->event.'|'.($r->category ?? '') => true]);

        $rows = collect($expected)->map(function ($e) use ($existing) {
            return [...$e, 'configured' => $existing->has($e['event'].'|'.($e['category'] ?? ''))];
        })->values();

        return response()->json([
            'total' => $rows->count(),
            'configured_count' => $rows->where('configured', true)->count(),
            'rows' => $rows,
        ]);
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

        $dynamicLeg = $data['dynamic_leg'] ?? null;
        $dynamicJournal = $data['dynamic_journal'] ?? false;

        if (! $dynamicLeg) {
            if (empty($data['debit_account_id']) || empty($data['credit_account_id'])) {
                abort(422, "Un compte débit et un compte crédit sont requis quand aucune jambe n'est dynamique.");
            }
            if ((int) $data['debit_account_id'] === (int) $data['credit_account_id']) {
                abort(422, 'Le compte débit et le compte crédit ne peuvent pas être identiques.');
            }
        } elseif ($dynamicLeg === 'debit' && empty($data['credit_account_id'])) {
            abort(422, 'Un compte crédit est requis quand la jambe débit est dynamique (trésorerie).');
        } elseif ($dynamicLeg === 'credit' && empty($data['debit_account_id'])) {
            abort(422, 'Un compte débit est requis quand la jambe crédit est dynamique (trésorerie).');
        }

        if (! $dynamicJournal && empty($data['journal_id'])) {
            abort(422, "Un journal est requis quand il n'est pas résolu dynamiquement.");
        }

        foreach (['debit_account_id', 'credit_account_id'] as $field) {
            if (empty($data[$field])) {
                continue;
            }
            $account = Account::find($data[$field]);
            if ($account && ! $account->is_active) {
                abort(422, sprintf(
                    'Le compte %s — %s est inactif et ne peut pas être utilisé dans une règle.',
                    $account->code,
                    $account->name,
                ));
            }
        }

        return $data;
    }
}
