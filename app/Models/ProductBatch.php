<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductBatch extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'batch_code',
        'product_id',
        'shop_id',
        'supplier_id',
        'purchase_order_item_id',
        'purchase_cost',
        'additional_costs',
        'cost_price',
        'min_profit_amount',
        'min_price',
        'quantity_received',
        'quantity_available',
        'received_at',
        'received_by',
    ];

    protected function casts(): array
    {
        return [
            'purchase_cost' => 'decimal:2',
            'additional_costs' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'min_profit_amount' => 'decimal:2',
            'min_price' => 'decimal:2',
            'received_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    /**
     * Named receivedByUser (not receivedBy) so the relation's snake-cased
     * JSON key ("received_by_user") never collides with the received_by
     * foreign key column when both are serialized on the same model.
     */
    public function receivedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
