<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankStatementLine;
use App\Models\JournalEntryLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BankStatementLineController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', BankStatementLine::class);

        $actor = $request->user();

        $query = BankStatementLine::query()->with(['account', 'importedByUser', 'journalEntryLine.journalEntry']);

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('account_id')) {
            $query->where('account_id', $request->integer('account_id'));
        }

        if ($request->filled('reconciled')) {
            $query->where('reconciled', $request->boolean('reconciled'));
        }

        return response()->json($query->orderByDesc('statement_date')->get());
    }

    /**
     * Journal entry lines for an account that no imported statement line has
     * been matched to yet — the "à pointer" side of the reconciliation.
     */
    public function unmatchedEntries(Request $request)
    {
        $this->authorize('viewAny', BankStatementLine::class);

        $actor = $request->user();

        $data = $request->validate([
            'account_id' => ['required', 'exists:accounts,id'],
            'shop_id' => ['nullable', 'exists:shops,id'],
        ]);

        $matchedIds = BankStatementLine::query()->whereNotNull('journal_entry_line_id')->pluck('journal_entry_line_id');

        $query = JournalEntryLine::query()
            ->where('account_id', $data['account_id'])
            ->whereNotIn('id', $matchedIds)
            ->whereHas('journalEntry', function ($q) use ($actor, $data) {
                if (! $actor->isSuperAdmin()) {
                    $q->where('shop_id', $actor->shop_id);
                } elseif (! empty($data['shop_id'])) {
                    $q->where('shop_id', $data['shop_id']);
                }
            })
            ->with('journalEntry');

        return response()->json($query->get()->sortByDesc(fn ($l) => $l->journalEntry->entry_date)->values());
    }

    public function store(Request $request)
    {
        $this->authorize('create', BankStatementLine::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'account_id' => ['required', 'exists:accounts,id'],
            'statement_date' => ['required', 'date'],
            'label' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez importer un relevé que pour votre propre boutique.');
        }

        $line = BankStatementLine::create([...$data, 'imported_by' => $actor->id]);

        return response()->json($line, 201);
    }

    /**
     * Parses a plain CSV file (date,label,amount — one line per row, no
     * header assumed unless the first row fails to parse as a date) and
     * imports each row as a statement line.
     */
    public function import(Request $request)
    {
        $this->authorize('create', BankStatementLine::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'account_id' => ['required', 'exists:accounts,id'],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez importer un relevé que pour votre propre boutique.');
        }

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if ($handle === false) {
            abort(422, 'Impossible de lire le fichier.');
        }

        $imported = 0;
        $skipped = 0;

        DB::transaction(function () use ($handle, $data, $actor, &$imported, &$skipped) {
            while (($row = fgetcsv($handle)) !== false) {
                if (count($row) < 3) {
                    $skipped++;

                    continue;
                }

                [$date, $label, $amount] = [trim($row[0]), trim($row[1]), trim(str_replace(',', '.', $row[2]))];
                $timestamp = strtotime($date);

                if ($timestamp === false || ! is_numeric($amount)) {
                    $skipped++;

                    continue;
                }

                BankStatementLine::create([
                    'shop_id' => $data['shop_id'],
                    'account_id' => $data['account_id'],
                    'statement_date' => date('Y-m-d', $timestamp),
                    'label' => $label ?: 'Opération',
                    'amount' => (float) $amount,
                    'imported_by' => $actor->id,
                ]);
                $imported++;
            }
        });

        fclose($handle);

        return response()->json(['imported' => $imported, 'skipped' => $skipped]);
    }

    public function match(Request $request, BankStatementLine $bankStatementLine)
    {
        $this->authorize('match', $bankStatementLine);

        $data = $request->validate([
            'journal_entry_line_id' => ['required', 'exists:journal_entry_lines,id'],
        ]);

        $line = JournalEntryLine::query()->findOrFail($data['journal_entry_line_id']);

        if ((int) $line->account_id !== (int) $bankStatementLine->account_id) {
            abort(422, "Cette écriture n'est pas sur le même compte que la ligne de relevé.");
        }

        $bankStatementLine->update([
            'reconciled' => true,
            'journal_entry_line_id' => $line->id,
        ]);

        return response()->json($bankStatementLine->load('journalEntryLine.journalEntry'));
    }

    public function unmatch(BankStatementLine $bankStatementLine)
    {
        $this->authorize('match', $bankStatementLine);

        $bankStatementLine->update(['reconciled' => false, 'journal_entry_line_id' => null]);

        return response()->json($bankStatementLine);
    }

    public function destroy(BankStatementLine $bankStatementLine)
    {
        $this->authorize('delete', $bankStatementLine);

        $bankStatementLine->delete();

        return response()->json(['message' => 'Ligne supprimée.']);
    }
}
