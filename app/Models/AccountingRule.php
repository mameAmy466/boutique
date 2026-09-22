<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingRule extends Model
{
    use HasFactory;

    public const EVENTS = [
        'sale',
        'expense',
        'supplier_debt_created',
        'supplier_debt_payment',
        'client_debt_created',
        'client_debt_payment',
    ];

    protected $fillable = [
        'event',
        'category',
        'dynamic_leg',
        'dynamic_journal',
        'debit_account_id',
        'credit_account_id',
        'journal_id',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'dynamic_journal' => 'boolean',
        ];
    }

    public function debitAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'debit_account_id');
    }

    public function creditAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'credit_account_id');
    }

    public function journal(): BelongsTo
    {
        return $this->belongsTo(AccountingJournal::class, 'journal_id');
    }
}
