<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingJournal extends Model
{
    use HasFactory;

    /**
     * Well-known journal codes the accounting engine resolves treasury
     * movements to, based on a payment_method — see AccountingEntryService.
     */
    public const CASH_CODE = 'CA';

    public const BANK_CODE = 'BQ';

    protected $fillable = [
        'code',
        'name',
    ];

    public function entries(): HasMany
    {
        return $this->hasMany(JournalEntry::class, 'journal_id');
    }

    public function rules(): HasMany
    {
        return $this->hasMany(AccountingRule::class, 'journal_id');
    }
}
