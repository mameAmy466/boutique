<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankStatementLine extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'account_id',
        'statement_date',
        'label',
        'amount',
        'reconciled',
        'journal_entry_line_id',
        'imported_by',
    ];

    protected function casts(): array
    {
        return [
            'statement_date' => 'date',
            'amount' => 'decimal:2',
            'reconciled' => 'boolean',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function journalEntryLine(): BelongsTo
    {
        return $this->belongsTo(JournalEntryLine::class);
    }

    public function importedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }
}
