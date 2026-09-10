<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use HasFactory;

    public const TYPE_ENTRY = 'entry';

    public const TYPE_SALE = 'sale';

    public const TYPE_TRANSFER_OUT = 'transfer_out';

    public const TYPE_TRANSFER_IN = 'transfer_in';

    public const TYPE_DAMAGE = 'damage';

    public const TYPE_LOSS = 'loss';

    public const TYPE_THEFT = 'theft';

    public const TYPE_EXPIRATION = 'expiration';

    public const TYPE_ADJUSTMENT = 'adjustment';

    public const TYPE_RETURN = 'return';

    protected $fillable = [
        'product_batch_id',
        'shop_id',
        'type',
        'quantity',
        'reference_type',
        'reference_id',
        'note',
        'user_id',
    ];

    public function productBatch(): BelongsTo
    {
        return $this->belongsTo(ProductBatch::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
