<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\AccountInUseException;
use App\Http\Controllers\Controller;
use App\Models\Account;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Account::class);

        return response()->json(Account::query()->orderBy('code')->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', Account::class);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:accounts,code'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(Account::TYPES)],
        ]);

        return response()->json(Account::create($data), 201);
    }

    public function update(Request $request, Account $account)
    {
        $this->authorize('update', $account);

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:20', Rule::unique('accounts', 'code')->ignore($account->id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(Account::TYPES)],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $account->update($data);

        return response()->json($account);
    }

    public function destroy(Account $account)
    {
        $this->authorize('delete', $account);

        $inUse = $account->journalEntryLines()->exists()
            || $account->debitRules()->exists()
            || $account->creditRules()->exists();

        if ($inUse) {
            throw new AccountInUseException();
        }

        $account->delete();

        return response()->json(['message' => 'Compte supprimé.']);
    }
}
