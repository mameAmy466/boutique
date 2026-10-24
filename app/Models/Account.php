<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use BelongsToOrganization, HasFactory;

    public const TYPES = ['actif', 'passif', 'tresorerie', 'charge', 'produit'];

    /**
     * Well-known codes the accounting engine resolves treasury movements
     * to, based on a payment_method — see AccountingEntryService.
     */
    public const CASH_CODE = '571';

    public const BANK_CODE = '512';

    protected $fillable = [
        'organization_id',
        'code',
        'name',
        'type',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function journalEntryLines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class);
    }

    public function debitRules(): HasMany
    {
        return $this->hasMany(AccountingRule::class, 'debit_account_id');
    }

    public function creditRules(): HasMany
    {
        return $this->hasMany(AccountingRule::class, 'credit_account_id');
    }
}
