<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingJournal;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountingJournalController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', AccountingJournal::class);

        return response()->json(AccountingJournal::query()->orderBy('code')->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', AccountingJournal::class);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:10', 'unique:accounting_journals,code'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        return response()->json(AccountingJournal::create($data), 201);
    }

    public function update(Request $request, AccountingJournal $accountingJournal)
    {
        $this->authorize('update', $accountingJournal);

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:10', Rule::unique('accounting_journals', 'code')->ignore($accountingJournal->id)],
            'name' => ['sometimes', 'string', 'max:255'],
        ]);

        $accountingJournal->update($data);

        return response()->json($accountingJournal);
    }

    public function destroy(AccountingJournal $accountingJournal)
    {
        $this->authorize('delete', $accountingJournal);

        if ($accountingJournal->entries()->exists() || $accountingJournal->rules()->exists()) {
            abort(422, 'Ce journal est utilisé par des écritures ou des règles comptables et ne peut pas être supprimé.');
        }

        $accountingJournal->delete();

        return response()->json(['message' => 'Journal supprimé.']);
    }
}
