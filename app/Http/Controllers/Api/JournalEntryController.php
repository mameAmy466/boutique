<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalEntry;
use Illuminate\Http\Request;

class JournalEntryController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', JournalEntry::class);

        $actor = $request->user();

        $query = JournalEntry::query()->with(['journal', 'shop', 'lines.account', 'createdByUser']);

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('journal_id')) {
            $query->where('journal_id', $request->integer('journal_id'));
        }

        if ($request->filled('account_id')) {
            $accountId = $request->integer('account_id');
            $query->whereHas('lines', fn ($q) => $q->where('account_id', $accountId));
        }

        if ($request->filled('from')) {
            $query->where('entry_date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->where('entry_date', '<=', $request->date('to'));
        }

        return response()->json($query->latest('entry_date')->latest('id')->get());
    }
}
