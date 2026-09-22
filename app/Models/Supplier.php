<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'tax_id', 'phone', 'email', 'address', 'payment_terms_days'];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function productBatches(): HasMany
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function debts(): HasMany
    {
        return $this->hasMany(SupplierDebt::class);
    }

    /**
     * Sum of what is still owed to this supplier, optionally scoped to one
     * shop — a supplier is shared across shops, so with no shop given this
     * is the consolidated balance across all of them.
     */
    public function totalDebt(?int $shopId = null): float
    {
        $query = $this->debts();
        if ($shopId) {
            $query->where('shop_id', $shopId);
        }

        return round((float) $query->get()->sum('remaining'), 2);
    }
}
