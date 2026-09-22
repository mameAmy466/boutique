<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Sale extends Model
{
    use HasFactory;

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_RETURNED = 'returned';

    public const STATUS_PARTIALLY_RETURNED = 'partially_returned';

    public const PAYMENT_METHODS = ['cash', 'card', 'wave', 'orange_money', 'free_money', 'transfer', 'other'];

    protected $fillable = [
        'sale_number',
        'shop_id',
        'user_id',
        'cash_session_id',
        'customer_name',
        'subtotal',
        'discount',
        'total',
        'payment_method',
        'status',
        'tax_rate',
        'cancellation_reason',
        'cancelled_by',
        'cancelled_at',
    ];

    protected $appends = ['tax_amount', 'subtotal_ht'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * The total is (and stays) TTC — VAT is extracted from it rather than
     * added on top, so cash reconciliation, accounting and stock keep
     * working exactly as before this column existed.
     */
    public function getTaxAmountAttribute(): float
    {
        $rate = (float) $this->tax_rate;
        if ($rate <= 0) {
            return 0.0;
        }

        $total = (float) $this->total;

        return round($total - $total / (1 + $rate / 100), 2);
    }

    public function getSubtotalHtAttribute(): float
    {
        return round((float) $this->total - $this->tax_amount, 2);
    }

    /**
     * Named cancelledByUser (not cancelledBy) so the relation's snake-cased
     * JSON key ("cancelled_by_user") never collides with the cancelled_by
     * foreign key column when both are serialized on the same model — the
     * same pitfall already hit and fixed on ProductBatch::receivedByUser().
     */
    public function cancelledByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSession::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }
}
