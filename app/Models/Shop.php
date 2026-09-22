<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shop extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'manager_name',
        'address',
        'phone',
        'email',
        'category',
        'monthly_budget',
        'sales_target',
        'low_stock_alert_threshold',
        'status',
        'closed_until',
    ];

    protected function casts(): array
    {
        return [
            'monthly_budget' => 'decimal:2',
            'sales_target' => 'decimal:2',
            'closed_until' => 'date',
        ];
    }

    /**
     * Whether a given date falls in a period this shop has already closed —
     * used to block backdated entries, edits and deletions once a période
     * comptable has been locked.
     */
    public function isDateLocked(string $date): bool
    {
        return $this->closed_until !== null && $date <= $this->closed_until->toDateString();
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function productBatches(): HasMany
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function cashRegisters(): HasMany
    {
        return $this->hasMany(CashRegister::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function supplierDebts(): HasMany
    {
        return $this->hasMany(SupplierDebt::class);
    }

    public function clientDebts(): HasMany
    {
        return $this->hasMany(ClientDebt::class);
    }
}
