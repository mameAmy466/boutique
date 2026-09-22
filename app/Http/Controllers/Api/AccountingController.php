<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\AccountingJournal;
use App\Models\Expense;
use App\Models\JournalEntry;
use App\Models\JournalEntryLine;
use App\Models\Sale;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountingController extends Controller
{
    private const WINDOWS = [
        'day' => 30,
        'week' => 84,
        'month' => 365,
        'year' => 365 * 5,
    ];

    /**
     * Compares sales (entrées) against expenses (sorties) grouped by
     * day/week/month/year. Grouping is done in PHP from day-level buckets
     * (queried with the portable DATE() function, already used by
     * DashboardController::salesTrend) rather than driver-specific SQL date
     * functions, since this app must run identically on MySQL and SQLite.
     */
    public function cashflow(Request $request)
    {
        $actor = $request->user();

        if (! $actor->isSuperAdmin() && ! $actor->isShopAdmin()) {
            abort(403, 'Réservé aux administrateurs.');
        }

        $groupBy = $request->string('group_by', 'month')->value();
        if (! array_key_exists($groupBy, self::WINDOWS)) {
            $groupBy = 'month';
        }

        $shopId = $actor->isSuperAdmin() ? $request->integer('shop_id') ?: null : $actor->shop_id;

        $from = now()->subDays(self::WINDOWS[$groupBy])->startOfDay();

        $entreesByDay = Sale::query()
            ->where('status', Sale::STATUS_COMPLETED)
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
            ->where('created_at', '>=', $from)
            ->select(DB::raw('DATE(created_at) as day'), DB::raw('SUM(total) as total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $sortiesByDay = Expense::query()
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
            ->where('expense_date', '>=', $from->toDateString())
            ->select(DB::raw('DATE(expense_date) as day'), DB::raw('SUM(amount) as total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $days = [];
        $cursor = $from->copy();
        $today = now()->startOfDay();
        while ($cursor->lte($today)) {
            $key = $cursor->toDateString();
            $days[] = [
                'date' => $cursor->copy(),
                'entrees' => (float) ($entreesByDay[$key] ?? 0),
                'sorties' => (float) ($sortiesByDay[$key] ?? 0),
            ];
            $cursor->addDay();
        }

        return response()->json($this->bucket($days, $groupBy));
    }

    /**
     * Per-account ledger (grand livre) with a running debit-minus-credit
     * balance: positive = solde débiteur, negative = solde créditeur.
     */
    public function ledger(Request $request, Account $account)
    {
        $this->authorize('viewAny', JournalEntry::class);

        $actor = $request->user();
        $shopId = $actor->isSuperAdmin()
            ? ($request->filled('shop_id') ? $request->integer('shop_id') : null)
            : $actor->shop_id;

        $from = $request->filled('from') ? $request->date('from') : null;
        $to = $request->filled('to') ? $request->date('to') : null;

        $baseQuery = function () use ($account, $shopId) {
            return JournalEntryLine::query()
                ->where('journal_entry_lines.account_id', $account->id)
                ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
                ->when($shopId, fn ($q) => $q->where('journal_entries.shop_id', $shopId));
        };

        $opening = 0.0;
        if ($from) {
            $opening = (float) $baseQuery()
                ->where('journal_entries.entry_date', '<', $from->toDateString())
                ->selectRaw('COALESCE(SUM(journal_entry_lines.debit), 0) - COALESCE(SUM(journal_entry_lines.credit), 0) as balance')
                ->value('balance');
        }

        $journalCodes = AccountingJournal::query()->pluck('code', 'id');

        $rows = $baseQuery()
            ->when($from, fn ($q) => $q->where('journal_entries.entry_date', '>=', $from->toDateString()))
            ->when($to, fn ($q) => $q->where('journal_entries.entry_date', '<=', $to->toDateString()))
            ->orderBy('journal_entries.entry_date')
            ->orderBy('journal_entries.id')
            ->get([
                'journal_entry_lines.debit',
                'journal_entry_lines.credit',
                'journal_entries.id as entry_id',
                'journal_entries.entry_date',
                'journal_entries.reference',
                'journal_entries.label',
                'journal_entries.journal_id',
            ]);

        $balance = $opening;
        $movements = $rows->map(function ($row) use (&$balance, $journalCodes) {
            $balance += (float) $row->debit - (float) $row->credit;

            return [
                'entry_id' => $row->entry_id,
                'entry_date' => Carbon::parse($row->entry_date)->toDateString(),
                'reference' => $row->reference,
                'label' => $row->label,
                'journal_code' => $journalCodes[$row->journal_id] ?? '—',
                'debit' => (float) $row->debit,
                'credit' => (float) $row->credit,
                'balance' => round($balance, 2),
            ];
        })->values();

        return response()->json([
            'account' => $account,
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
            'opening_balance' => round($opening, 2),
            'movements' => $movements,
            'closing_balance' => round($balance, 2),
        ]);
    }

    /**
     * Trial balance (balance comptable): per account, opening balance, period
     * debit/credit totals and closing balance. Only accounts that are active
     * or have movement in scope are listed.
     */
    public function trialBalance(Request $request)
    {
        $this->authorize('viewAny', JournalEntry::class);

        $actor = $request->user();
        $shopId = $actor->isSuperAdmin()
            ? ($request->filled('shop_id') ? $request->integer('shop_id') : null)
            : $actor->shop_id;

        $from = $request->filled('from') ? $request->date('from') : null;
        $to = $request->filled('to') ? $request->date('to') : null;

        $baseQuery = function () use ($shopId) {
            return JournalEntryLine::query()
                ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
                ->when($shopId, fn ($q) => $q->where('journal_entries.shop_id', $shopId));
        };

        $opening = $from
            ? $baseQuery()
                ->where('journal_entries.entry_date', '<', $from->toDateString())
                ->groupBy('journal_entry_lines.account_id')
                ->selectRaw('journal_entry_lines.account_id as account_id, COALESCE(SUM(journal_entry_lines.debit), 0) - COALESCE(SUM(journal_entry_lines.credit), 0) as balance')
                ->get()
                ->keyBy('account_id')
            : collect();

        $period = $baseQuery()
            ->when($from, fn ($q) => $q->where('journal_entries.entry_date', '>=', $from->toDateString()))
            ->when($to, fn ($q) => $q->where('journal_entries.entry_date', '<=', $to->toDateString()))
            ->groupBy('journal_entry_lines.account_id')
            ->selectRaw('journal_entry_lines.account_id as account_id, COALESCE(SUM(journal_entry_lines.debit), 0) as debit, COALESCE(SUM(journal_entry_lines.credit), 0) as credit')
            ->get()
            ->keyBy('account_id');

        $movedAccountIds = $opening->keys()->merge($period->keys())->unique();

        $accounts = Account::query()
            ->where(fn ($q) => $q->where('is_active', true)->orWhereIn('id', $movedAccountIds))
            ->orderBy('code')
            ->get();

        $rows = $accounts->map(function (Account $account) use ($opening, $period) {
            $openingBalance = (float) ($opening[$account->id]->balance ?? 0);
            $debit = (float) ($period[$account->id]->debit ?? 0);
            $credit = (float) ($period[$account->id]->credit ?? 0);

            return [
                'account' => ['id' => $account->id, 'code' => $account->code, 'name' => $account->name, 'type' => $account->type],
                'opening_balance' => round($openingBalance, 2),
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'closing_balance' => round($openingBalance + $debit - $credit, 2),
            ];
        })->filter(function ($row) {
            return $row['opening_balance'] !== 0.0 || $row['debit'] !== 0.0 || $row['credit'] !== 0.0 || $row['closing_balance'] !== 0.0;
        })->values();

        $totals = [
            'opening_balance' => round($rows->sum('opening_balance'), 2),
            'debit' => round($rows->sum('debit'), 2),
            'credit' => round($rows->sum('credit'), 2),
            'closing_balance' => round($rows->sum('closing_balance'), 2),
        ];

        return response()->json([
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
            'rows' => $rows,
            'totals' => $totals,
        ]);
    }

    /**
     * Compte de résultat: charges and produits accounts over a period, with
     * the net result (bénéfice or perte) they net out to.
     */
    public function incomeStatement(Request $request)
    {
        $this->authorize('viewAny', JournalEntry::class);

        $actor = $request->user();
        $shopId = $actor->isSuperAdmin()
            ? ($request->filled('shop_id') ? $request->integer('shop_id') : null)
            : $actor->shop_id;

        $from = $request->filled('from') ? $request->date('from') : null;
        $to = $request->filled('to') ? $request->date('to') : null;

        $baseQuery = function () use ($shopId) {
            return JournalEntryLine::query()
                ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
                ->when($shopId, fn ($q) => $q->where('journal_entries.shop_id', $shopId));
        };

        $period = $baseQuery()
            ->when($from, fn ($q) => $q->where('journal_entries.entry_date', '>=', $from->toDateString()))
            ->when($to, fn ($q) => $q->where('journal_entries.entry_date', '<=', $to->toDateString()))
            ->groupBy('journal_entry_lines.account_id')
            ->selectRaw('journal_entry_lines.account_id as account_id, COALESCE(SUM(journal_entry_lines.debit), 0) as debit, COALESCE(SUM(journal_entry_lines.credit), 0) as credit')
            ->get()
            ->keyBy('account_id');

        $accounts = Account::query()->whereIn('type', ['charge', 'produit'])->orderBy('code')->get();

        $charges = [];
        $produits = [];

        foreach ($accounts as $account) {
            $row = $period[$account->id] ?? null;
            $debit = (float) ($row->debit ?? 0);
            $credit = (float) ($row->credit ?? 0);

            if ($debit === 0.0 && $credit === 0.0) {
                continue;
            }

            $entry = ['account' => ['id' => $account->id, 'code' => $account->code, 'name' => $account->name]];

            if ($account->type === 'charge') {
                $entry['amount'] = round($debit - $credit, 2);
                $charges[] = $entry;
            } else {
                $entry['amount'] = round($credit - $debit, 2);
                $produits[] = $entry;
            }
        }

        $totalCharges = round(array_sum(array_column($charges, 'amount')), 2);
        $totalProduits = round(array_sum(array_column($produits, 'amount')), 2);

        return response()->json([
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
            'charges' => $charges,
            'produits' => $produits,
            'total_charges' => $totalCharges,
            'total_produits' => $totalProduits,
            'net_result' => round($totalProduits - $totalCharges, 2),
        ]);
    }

    /**
     * Bilan: actif and passif account balances as of a date (cumulative
     * since the very first entry), with the not-yet-closed net result shown
     * as the plug that makes actif = passif + résultat.
     */
    public function balanceSheet(Request $request)
    {
        $this->authorize('viewAny', JournalEntry::class);

        $actor = $request->user();
        $shopId = $actor->isSuperAdmin()
            ? ($request->filled('shop_id') ? $request->integer('shop_id') : null)
            : $actor->shop_id;

        $to = $request->filled('to') ? $request->date('to') : null;

        $balances = JournalEntryLine::query()
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->when($shopId, fn ($q) => $q->where('journal_entries.shop_id', $shopId))
            ->when($to, fn ($q) => $q->where('journal_entries.entry_date', '<=', $to->toDateString()))
            ->groupBy('journal_entry_lines.account_id')
            ->selectRaw('journal_entry_lines.account_id as account_id, COALESCE(SUM(journal_entry_lines.debit), 0) - COALESCE(SUM(journal_entry_lines.credit), 0) as balance')
            ->get()
            ->keyBy('account_id');

        $accounts = Account::query()->orderBy('code')->get();

        $actif = [];
        $passif = [];
        $totalCharges = 0.0;
        $totalProduits = 0.0;

        foreach ($accounts as $account) {
            $balance = (float) ($balances[$account->id]->balance ?? 0);
            if (abs($balance) < 0.005) {
                continue;
            }

            $entry = ['account' => ['id' => $account->id, 'code' => $account->code, 'name' => $account->name]];

            match ($account->type) {
                'actif', 'tresorerie' => $actif[] = [...$entry, 'amount' => round($balance, 2)],
                'passif' => $passif[] = [...$entry, 'amount' => round(-$balance, 2)],
                'charge' => $totalCharges += $balance,
                'produit' => $totalProduits += -$balance,
                default => null,
            };
        }

        $netResult = round($totalProduits - $totalCharges, 2);
        $totalActif = round(array_sum(array_column($actif, 'amount')), 2);
        $totalPassif = round(array_sum(array_column($passif, 'amount')), 2);

        return response()->json([
            'to' => $to?->toDateString(),
            'actif' => $actif,
            'passif' => $passif,
            'net_result' => $netResult,
            'total_actif' => $totalActif,
            'total_passif' => round($totalPassif + $netResult, 2),
        ]);
    }

    /**
     * Périodic integrity control: total debit must equal total credit across
     * every journal entry line, and each individual entry must balance on
     * its own — catches any bug or manual tampering the "always balanced by
     * construction" design should otherwise guarantee.
     */
    public function integrityCheck(Request $request)
    {
        $this->authorize('viewAny', JournalEntry::class);

        $actor = $request->user();
        $shopId = $actor->isSuperAdmin()
            ? ($request->filled('shop_id') ? $request->integer('shop_id') : null)
            : $actor->shop_id;

        $baseQuery = function () use ($shopId) {
            return JournalEntryLine::query()
                ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
                ->when($shopId, fn ($q) => $q->where('journal_entries.shop_id', $shopId));
        };

        $totals = $baseQuery()
            ->selectRaw('COALESCE(SUM(journal_entry_lines.debit), 0) as debit, COALESCE(SUM(journal_entry_lines.credit), 0) as credit')
            ->first();

        $unbalancedIds = $baseQuery()
            ->groupBy('journal_entry_lines.journal_entry_id')
            ->havingRaw('ABS(COALESCE(SUM(journal_entry_lines.debit), 0) - COALESCE(SUM(journal_entry_lines.credit), 0)) > 0.005')
            ->pluck('journal_entry_lines.journal_entry_id');

        $unbalancedEntries = JournalEntry::query()
            ->whereIn('id', $unbalancedIds)
            ->with('lines')
            ->get()
            ->map(fn (JournalEntry $entry) => [
                'id' => $entry->id,
                'reference' => $entry->reference,
                'label' => $entry->label,
                'entry_date' => $entry->entry_date->toDateString(),
                'diff' => round((float) $entry->lines->sum('debit') - (float) $entry->lines->sum('credit'), 2),
            ]);

        return response()->json([
            'total_debit' => round((float) $totals->debit, 2),
            'total_credit' => round((float) $totals->credit, 2),
            'balanced' => abs((float) $totals->debit - (float) $totals->credit) < 0.01,
            'unbalanced_entries' => $unbalancedEntries->values(),
        ]);
    }

    /**
     * The period key is always a real ISO date (the bucket's start day), so
     * ordering is a plain string sort and the frontend — already fluent in
     * fr-FR date formatting (see lib/format.ts) — derives the display label
     * itself instead of trusting a backend string baked with the server's
     * locale (APP_LOCALE is "en", not "fr").
     */
    private function bucket(array $days, string $groupBy): array
    {
        $buckets = [];

        foreach ($days as $day) {
            /** @var Carbon $date */
            $date = $day['date'];
            $key = match ($groupBy) {
                'day' => $date->toDateString(),
                'week' => $date->copy()->startOfWeek()->toDateString(),
                'year' => $date->copy()->startOfYear()->toDateString(),
                default => $date->copy()->startOfMonth()->toDateString(),
            };

            $buckets[$key] ??= ['period' => $key, 'entrees' => 0.0, 'sorties' => 0.0];
            $buckets[$key]['entrees'] += $day['entrees'];
            $buckets[$key]['sorties'] += $day['sorties'];
        }

        ksort($buckets);

        return array_values(array_map(function ($bucket) {
            $bucket['entrees'] = round($bucket['entrees'], 2);
            $bucket['sorties'] = round($bucket['sorties'], 2);
            $bucket['net'] = round($bucket['entrees'] - $bucket['sorties'], 2);

            return $bucket;
        }, $buckets));
    }
}
