<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'name',
        'tax_id',
        'phone',
        'address',
        'payment_terms_days',
        'credit_limit',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit' => 'decimal:2',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function debts(): HasMany
    {
        return $this->hasMany(ClientDebt::class);
    }

    /**
     * Sum of what is still owed across every debt of this customer. A live
     * query (not an accessor) so it is never accidentally run on every row
     * of an index listing — callers that need it fetch it explicitly.
     */
    public function totalDebt(): float
    {
        return round((float) $this->debts()->get()->sum('remaining'), 2);
    }
}
