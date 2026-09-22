<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientDebt extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'customer_id',
        'invoice_number',
        'amount',
        'due_date',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'due_date' => 'date',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ClientDebtPayment::class);
    }

    /**
     * Mirrors SupplierDebt::getPaidAmountAttribute() — see that model for
     * why the eager-loaded sum is preferred over a live query.
     */
    public function getPaidAmountAttribute(): float
    {
        if (array_key_exists('payments_sum_amount', $this->attributes)) {
            return (float) $this->attributes['payments_sum_amount'];
        }

        return (float) $this->payments()->sum('amount');
    }

    public function getRemainingAttribute(): float
    {
        return round((float) $this->amount - $this->paid_amount, 2);
    }

    public function getStatusAttribute(): string
    {
        if ($this->paid_amount <= 0) {
            return 'pending';
        }

        return $this->remaining <= 0 ? 'paid' : 'partial';
    }

    protected $appends = ['paid_amount', 'remaining', 'status'];
}
